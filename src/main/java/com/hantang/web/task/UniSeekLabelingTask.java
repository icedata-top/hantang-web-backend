package com.hantang.web.task;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.hantang.web.api.LlmClient;
import com.hantang.web.api.LlmClient.*;
import com.hantang.web.service.labeling.VideoLabelingStore;
import com.hantang.web.service.labeling.VideoLabelingStore.*;
import java.io.*;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.sql.SQLException;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

/** Bounded HTTP producers and one coordinator that commits batches before counting progress. */
public final class UniSeekLabelingTask implements Runnable {
    @FunctionalInterface public interface Clients { LlmClient open() throws IOException; }
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final int BATCH_SIZE = 20, MAX_RETRIES = 2;
    private final VideoLabelingStore store;
    private final Request request;
    private final Clients clients;
    private final String id;
    private final Path directory;
    private final AtomicReference<ObjectNode> published = new AtomicReference<>();
    private final AtomicBoolean stop = new AtomicBoolean();
    private final AtomicInteger active = new AtomicInteger();
    private volatile Thread owner;
    private final Stats stats;
    private long lastDiskWrite;

    public UniSeekLabelingTask(VideoLabelingStore store, Request request, Clients clients, String id, Path directory) throws IOException {
        this.store = store; this.request = request; this.clients = clients; this.id = id; this.directory = directory;
        stats = new Stats();
        Files.createDirectories(directory);
        publish(true);
    }
    public ObjectNode snapshot() {
        var snapshot = published.get().deepCopy();
        if (stop.get() && snapshot.path("active").asBoolean()) snapshot.put("status", "stopping");
        return snapshot;
    }
    public boolean isActive() { return published.get().path("active").asBoolean(); }
    public void requestStop() { stop.set(true); Thread thread = owner; if (thread != null) thread.interrupt(); }
    public Path directory() { return directory; }
    public void failToStart() { stats.status = "failed"; stats.error = "START_FAILED"; stats.finished = Instant.now(); try { publish(true); } catch (IOException ignored) { } }
    private void checkStop() throws InterruptedException { if (stop.get() || Thread.currentThread().isInterrupted()) throw new InterruptedException(); }

    @Override public void run() {
        owner = Thread.currentThread();
        String stage = "DATABASE_NOT_READY";
        boolean interrupted = false;
        try {
            checkStop();
            try (var lease = store.acquire()) {
                stats.status = "preparing"; publish(true);
                var selection = store.prepare(request, directory.resolve("input-batches.jsonl"));
                checkStop();
                stats.selected = selection.count(); stats.selectionPrepared = true; stats.sourceBatch = selection.batchId(); stats.sourceDate = selection.recordDate();
                publish(true);
                if (selection.count() == 0) { stats.status = "completed"; return; }
                stage = "LLM_CONFIGURATION_ERROR";
                String prompt;
                try (var input = getClass().getResourceAsStream("/prompt/VideoTypeAndLanguageAnalysis.md")) {
                    if (input == null) throw new IOException("PROMPT_MISSING");
                    prompt = new String(input.readAllBytes(), StandardCharsets.UTF_8);
                }
                String digest = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(prompt.getBytes(StandardCharsets.UTF_8)));
                stats.promptSha = digest;
                try (var client = clients.open()) {
                    stats.model = client.modelName(); stats.status = "running";
                    var context = new Context(request.mode(), id, client.modelName(), digest);
                    stage = "EXECUTION_FAILED";
                    execute(client, prompt, context, lease);
                    stats.status = stats.failed > 0 ? "completed_with_failures" : "completed";
                }
            }
        } catch (InterruptedException e) {
            interrupted = !stop.get(); stop.set(true); stats.status = "stopped";
        } catch (Exception e) {
            if (stop.get() || Thread.currentThread().isInterrupted()) {
                interrupted = !stop.get(); stats.status = "stopped";
            } else {
                stats.status = "failed";
                stats.error = stats.error != null ? stats.error
                        : stats.attempts == 0 && e instanceof SQLException sql && "55P03".equals(sql.getSQLState()) ? "ANOTHER_TASK_RUNNING"
                        : stats.attempts == 0 && e instanceof SQLException sql && "42501".equals(sql.getSQLState()) ? "DB_WRITE_PERMISSION_REQUIRED" : stage;
            }
        } finally {
            Thread.interrupted();
            stats.finished = Instant.now();
            try { publish(true); } catch (IOException ignored) { /* Committed PostgreSQL rows remain the source of truth. */ }
            owner = null;
            if (interrupted) Thread.currentThread().interrupt();
        }
    }

    private record Work(int index, List<VideoInput> videos, int attempt, long readyAt) { }
    private record Flight(Work work, LlmRequestBudget.Reservation reservation) { }
    private record Reply(AnalysisResponse response, Exception failure, long elapsedMs) { }
    private void execute(LlmClient client, String prompt, Context context, Lease lease) throws Exception {
        var workers = Executors.newFixedThreadPool(request.concurrency(), runnable -> {
            var thread = new Thread(runnable, "uniseek-label-http"); thread.setDaemon(true); return thread;
        });
        var completions = new ExecutorCompletionService<Reply>(workers);
        var flights = new HashMap<Future<Reply>, Flight>();
        var queue = new PriorityQueue<Work>(Comparator.comparingLong(Work::readyAt).thenComparingInt(Work::index));
        var budget = new LlmRequestBudget(client.executionTpm(), client.executionRpm());
        boolean eof = false;
        int nextIndex = 1;
        long nextSend = 0, nextLeaseCheck = 0;
        try (var reader = Files.newBufferedReader(directory.resolve("input-batches.jsonl"), StandardCharsets.UTF_8);
             var audit = Files.newBufferedWriter(directory.resolve("attempts.jsonl"), StandardCharsets.UTF_8, StandardOpenOption.CREATE_NEW)) {
            try {
                while (!eof || !queue.isEmpty() || !flights.isEmpty()) {
                    checkStop();
                    long now = System.nanoTime();
                    if (now >= nextLeaseCheck) { lease.verify(); nextLeaseCheck = now + TimeUnit.SECONDS.toNanos(1); }
                    while (!eof && queue.size() + flights.size() < request.concurrency() * 2) {
                        String line = reader.readLine();
                        if (line == null) { eof = true; break; }
                        var videos = List.of(JSON.readValue(line, VideoInput[].class));
                        if (videos.isEmpty() || videos.size() > BATCH_SIZE) throw new IOException("INVALID_INPUT_BATCH");
                        queue.add(new Work(nextIndex++, videos, 1, 0));
                    }
                    stats.bufferedBatches = queue.size() + flights.size();
                    if (!queue.isEmpty() && flights.size() < request.concurrency() && now >= queue.peek().readyAt() && now >= nextSend) {
                        Work work = queue.peek();
                        long estimate = prompt.length() + JSON.writeValueAsString(work.videos()).length() + work.videos().size() * 192L + 512;
                        long wait = budget.waitMs(stats.elapsed(), estimate);
                        if (wait > 0) { nextSend = now + TimeUnit.MILLISECONDS.toNanos(wait); stats.waitUntil = nextSend; }
                        else {
                            queue.remove();
                            var event = event(work, "started"); write(audit, event);
                            stats.attempts++; if (work.attempt() > 1) stats.retries++;
                            stats.starts.add(new Sample(stats.elapsed(), 1));
                            var reservation = budget.reserve(stats.elapsed(), estimate);
                            var future = completions.submit(() -> {
                                long started = System.nanoTime(); active.incrementAndGet();
                                try { var response = client.analyze(work.videos(), prompt); return new Reply(response, null, response.elapsedMs()); }
                                catch (IOException | InterruptedException | RuntimeException e) {
                                    return new Reply(null, e, e instanceof AnalysisException failure ? failure.elapsedMs() : (System.nanoTime() - started) / 1_000_000);
                                } finally { active.decrementAndGet(); }
                            });
                            flights.put(future, new Flight(work, reservation));
                            nextSend = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(100); stats.waitUntil = 0;
                        }
                    }
                    Future<Reply> future = completions.poll(100, TimeUnit.MILLISECONDS);
                    if (future != null) {
                        Flight flight = flights.remove(future); Work work = flight.work(); Reply reply = future.get();
                        stats.finishedAttempts++; stats.durationTotal += reply.elapsedMs(); stats.durationMax = Math.max(stats.durationMax, reply.elapsedMs());
                        var event = event(work, reply.failure() == null ? "received" : "failed").put("elapsed_ms", reply.elapsedMs());
                        TokenUsage usage = reply.response() != null ? reply.response().usage()
                                : reply.failure() instanceof AnalysisException failure ? failure.usage() : new TokenUsage(null, null, null);
                        stats.usage(usage); event.set("usage", JSON.valueToTree(usage));
                        budget.reconcile(flight.reservation(), usage.totalTokens());
                        if (usage.totalTokens() != null) stats.tokens.add(new Sample(stats.elapsed(), usage.totalTokens()));
                        if (reply.failure() != null) {
                            stats.failedAttempts++;
                            String code = reply.failure() instanceof AnalysisException failure ? failure.code() : "CLIENT_IO_ERROR";
                            stats.lastError = code; event.put("error", code);
                            if (reply.failure() instanceof AnalysisException failure) {
                                if (failure.rawModelOutput() != null) event.put("raw_model_output", failure.rawModelOutput());
                                if (failure.httpStatus() != null) event.put("http_status", failure.httpStatus());
                            }
                            write(audit, event);
                            if (work.attempt() <= MAX_RETRIES) {
                                long delay = 1000L * work.attempt() + ThreadLocalRandom.current().nextLong(250);
                                if (reply.failure() instanceof AnalysisException failure && failure.retryAfterMs() != null) delay = Math.max(delay, failure.retryAfterMs());
                                queue.add(new Work(work.index(), work.videos(), work.attempt() + 1, System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(delay)));
                            } else {
                                stats.failed += work.videos().size(); stats.completedBatches++;
                                stats.finishes.add(new Sample(stats.elapsed(), work.videos().size()));
                            }
                        } else {
                            event.set("results", JSON.valueToTree(reply.response().results()));
                            write(audit, event); checkStop();
                            int stored;
                            try { lease.verify(); stored = store.save(work.videos(), reply.response(), context); }
                            catch (SQLException | RuntimeException e) { stats.error = "DATABASE_WRITE_FAILED"; throw e; }
                            if (stored < 0 || stored > work.videos().size()) throw new SQLException("INVALID_COMMIT_COUNT");
                            stats.succeeded += stored; stats.skipped += work.videos().size() - stored; stats.completedBatches++;
                            stats.finishes.add(new Sample(stats.elapsed(), work.videos().size()));
                            write(audit, event(work, "committed").put("stored_count", stored).put("skipped_count", work.videos().size() - stored));
                        }
                        if (stats.waitUntil > 0) { nextSend = 0; stats.waitUntil = 0; }
                    }
                    stats.waitingRetries = (int) queue.stream().filter(work -> work.attempt() > 1).count();
                    stats.retryWait = flights.isEmpty() && !queue.isEmpty() ? Math.max(0, queue.peek().readyAt() - System.nanoTime()) : 0;
                    publish(false);
                }
            } finally {
                for (var entry : flights.entrySet()) {
                    entry.getKey().cancel(true);
                    try { write(audit, event(entry.getValue().work(), "outcome_uncertain")); } catch (IOException ignored) { }
                }
            }
        } finally { workers.shutdownNow(); }
    }
    private ObjectNode event(Work work, String status) {
        var event = JSON.createObjectNode().put("batch_index", work.index()).put("attempt", work.attempt()).put("status", status).put("at", Instant.now().toString());
        var aids = event.putArray("aids"); work.videos().forEach(video -> aids.add(video.aid())); return event;
    }
    private static void write(BufferedWriter writer, ObjectNode value) throws IOException { writer.write(JSON.writeValueAsString(value)); writer.newLine(); writer.flush(); }
    private void publish(boolean force) throws IOException {
        ObjectNode value = stats.snapshot(); published.set(value);
        if (!force && System.nanoTime() - lastDiskWrite < TimeUnit.SECONDS.toNanos(1)) return;
        Path temp = Files.createTempFile(directory, ".status-", ".tmp");
        try {
            JSON.writerWithDefaultPrettyPrinter().writeValue(temp.toFile(), value);
            try { Files.move(temp, directory.resolve("status.json"), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING); }
            catch (AtomicMoveNotSupportedException ignored) { Files.move(temp, directory.resolve("status.json"), StandardCopyOption.REPLACE_EXISTING); }
            lastDiskWrite = System.nanoTime();
        } finally { Files.deleteIfExists(temp); }
    }
    private record Sample(long at, long value) { }
    private static long sum(ArrayDeque<Sample> samples, long now) {
        while (!samples.isEmpty() && samples.peek().at() <= now - 60_000) samples.remove();
        return samples.stream().mapToLong(Sample::value).sum();
    }
    private final class Stats {
        final long started = System.nanoTime();
        final Instant startedAt = Instant.now();
        Instant finished;
        String status = "queued", model, promptSha, sourceBatch, sourceDate, error, lastError;
        boolean selectionPrepared;
        int selected = request.count(), succeeded, failed, skipped, completedBatches, attempts, finishedAttempts, failedAttempts, retries, waitingRetries, bufferedBatches;
        long durationTotal, durationMax, waitUntil, retryWait, finalElapsed = -1;
        final BigInteger[] totals = {BigInteger.ZERO, BigInteger.ZERO, BigInteger.ZERO};
        final int[] known = new int[3], missing = new int[3];
        final ArrayDeque<Sample> starts = new ArrayDeque<>(), finishes = new ArrayDeque<>(), tokens = new ArrayDeque<>();
        long elapsed() { return finalElapsed >= 0 ? finalElapsed : (System.nanoTime() - started) / 1_000_000; }
        void usage(TokenUsage usage) {
            Long[] values = {usage.promptTokens(), usage.completionTokens(), usage.totalTokens()};
            for (int i = 0; i < 3; i++) if (values[i] == null) missing[i]++; else { known[i]++; totals[i] = totals[i].add(BigInteger.valueOf(values[i])); }
        }
        ObjectNode snapshot() {
            if (finished != null && finalElapsed < 0) finalElapsed = elapsed();
            long now = elapsed(); int remaining = Math.max(0, selected - succeeded - failed - skipped);
            var root = JSON.createObjectNode().put("id", id).put("active", finished == null).put("status", status)
                    .put("mode", request.mode()).put("requested_count", request.count()).put("selected_count", selected)
                    .put("selection_prepared", selectionPrepared)
                    .put("concurrency", request.concurrency()).put("batch_size", BATCH_SIZE).put("elapsed_ms", now)
                    .put("started_at", startedAt.toString()).put("snapshot_at", Instant.now().toString())
                    .put("active_requests", finished == null ? active.get() : 0).put("model", model).put("prompt_sha256", promptSha)
                    .put("source_batch_id", sourceBatch).put("source_record_date", sourceDate).put("buffered_batches", bufferedBatches);
            if (finished != null) root.put("finished_at", finished.toString());
            if (error != null) root.putObject("fatal_error").put("code", error);
            if (lastError != null) root.putObject("last_error").put("code", lastError);
            var summary = root.putObject("summary").put("succeeded_count", succeeded).put("failed_count", failed).put("skipped_count", skipped)
                    .put("pending_count", remaining).put("request_attempt_count", attempts).put("finished_attempt_count", finishedAttempts)
                    .put("failed_attempt_count", failedAttempts).put("retry_count", retries).put("completed_batches", completedBatches);
            if (finishedAttempts > 0) {
                summary.put("request_elapsed_ms_avg", (double) durationTotal / finishedAttempts).put("request_failure_rate", (double) failedAttempts / finishedAttempts);
            } else { summary.putNull("request_elapsed_ms_avg"); summary.putNull("request_failure_rate"); }
            var reported = summary.putObject("reported_usage"); var unknown = summary.putObject("usage_missing_attempts");
            String[] keys = {"prompt_tokens", "completion_tokens", "total_tokens"};
            for (int i = 0; i < 3; i++) { if (known[i] > 0) reported.put(keys[i], totals[i]); else reported.putNull(keys[i]); unknown.put(keys[i], missing[i]); }
            long done = sum(finishes, now); double minutes = Math.max(1, Math.min(now, 60_000)) / 60_000.0;
            long waitMs = Math.max(Math.max(0, TimeUnit.NANOSECONDS.toMillis(waitUntil - System.nanoTime())), TimeUnit.NANOSECONDS.toMillis(retryWait));
            var live = root.putObject("live").put("remaining_count", remaining).put("videos_per_minute", done / minutes)
                    .put("rpm", sum(starts, now) / minutes).put("waiting_retries", waitingRetries).put("budget_wait_ms", waitMs);
            long tokenSum = sum(tokens, now);
            if (known[2] > 0) live.put("tpm", tokenSum / minutes); else live.putNull("tpm");
            Long eta = VideoTypeAndLanguageAnalysisTask.estimateRemainingMs(now, completedBatches, remaining, done, waitMs, finished == null && "running".equals(status));
            live.put("eta_state", eta != null ? "available" : finished == null && "running".equals(status) && (now < 30_000 || completedBatches < 2) ? "warming_up" : "unavailable");
            if (eta == null) { live.putNull("eta_ms"); live.putNull("estimated_completion_at"); }
            else live.put("eta_ms", eta).put("estimated_completion_at", Instant.now().plusMillis(eta).toString());
            return root;
        }
    }
}
