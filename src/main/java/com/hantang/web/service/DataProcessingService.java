package com.hantang.web.service;

import com.hantang.web.dao.DataProcessingDao;
import com.hantang.web.dao.DataProcessingDao.Source;
import com.hantang.web.dos.admin.DataProcessingResponse;
import com.hantang.web.dos.admin.DataProcessingResponse.*;

import java.time.*;
import java.util.*;
import java.util.concurrent.*;

import static com.hantang.web.dao.DataProcessingDao.number;

public class DataProcessingService {
    private static final Executor EXECUTOR = new ThreadPoolExecutor(2, 2, 0L, TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(16), Thread.ofPlatform().daemon().name("processing-", 0).factory());
    private record Cached(Instant expiresAt, CompletableFuture<DataProcessingResponse> result) {}
    private final Map<Source, Cached> cache = new EnumMap<>(Source.class);
    private final DataProcessingDao dao;
    private final Clock clock;
    private final Executor executor;
    public DataProcessingService() { this(new DataProcessingDao(), Clock.systemUTC(), EXECUTOR); }
    public DataProcessingService(DataProcessingDao dao, Clock clock, Executor executor) { this.dao = dao; this.clock = clock; this.executor = executor; }

    public synchronized CompletableFuture<DataProcessingResponse> get(Source source) {
        var now = clock.instant();
        var existing = cache.get(source);
        if (existing != null && now.isBefore(existing.expiresAt) && !existing.result.isCompletedExceptionally()) return existing.result;
        var future = CompletableFuture.supplyAsync(() -> source == Source.SCHEDULER ? scheduler() : result(source), executor);
        cache.put(source, new Cached(now.plusSeconds(60), future));
        return future;
    }

    private DataProcessingResponse result(Source source) {
        var meta = dao.metadata("hantang_dynamic", source.table);
        var notes = new ArrayList<String>();
        String availability = !meta.exists() ? "missing" : !meta.readable() ? "forbidden" : "available";
        var snapshot = new Snapshot("hantang_dynamic." + source.table, null, meta.estimatedRows(), null, null, null, null);
        if (!meta.readable()) return response(source, availability, "unobservable", snapshot, null, null, List.of(), List.of("result_" + availability));
        var row = source == Source.SEARCH ? dao.searchSnapshot() : dao.aggregateSnapshot();
        snapshot = new Snapshot(snapshot.table(), number(row.get("rows")), meta.estimatedRows(), text(row, "data_date"),
                text(row, "updated_at"), text(row, "batch_id"), (Boolean) row.get("complete"));
        String status = snapshot.rows() == null || snapshot.rows() == 0 ? "empty" : "ready";
        var batches = number(row.get("batches"));
        if (snapshot.rows() != null && snapshot.rows() > 0 && (batches == null || batches != 1
                || source == Source.SEARCH && !Objects.equals(row.get("first_date"), row.get("data_date")))) status = "inconsistent";
        if (status.equals("ready") && Boolean.FALSE.equals(snapshot.complete())) status = "incomplete";
        Publication publication = null;
        Task task = null;
        try {
            var control = dao.metadata("hantang_dynamic", source.control);
            if (!control.readable()) notes.add(control.exists() ? "control_forbidden" : "control_missing");
            else if (source == Source.SEARCH) {
                var rows = dao.publication();
                if (rows.size() != 1) notes.add("control_missing");
                else {
                    var state = rows.getFirst();
                    publication = new Publication(text(state, "requested_date"), text(state, "published_date"), Boolean.TRUE.equals(state.get("pending")));
                    // Do not compare two separately read snapshots: publication may commit between them.
                    if (publication.pending() && status.equals("ready")) status = "waiting";
                }
            } else {
                var rows = dao.latestTask();
                if (!rows.isEmpty()) {
                    var state = rows.getFirst();
                    task = new Task(text(state, "date"), text(state, "status"), integer(state, "attempt_count"), integer(state, "max_attempts"),
                            text(state, "started_at"), text(state, "finished_at"), text(state, "updated_at"));
                    if ("failed".equals(task.status())) status = "failed";
                    else if ("running".equals(task.status()) && !status.equals("inconsistent")) status = "running";
                    else if (Set.of("pending", "retry_wait").contains(Objects.toString(task.status(), "")) && status.equals("ready")) status = "waiting";
                } else notes.add("no_task");
            }
        } catch (RuntimeException error) { notes.add("control_unavailable"); }
        return response(source, availability, status, snapshot, task, publication, List.of(), notes);
    }

    private DataProcessingResponse scheduler() {
        var source = Source.SCHEDULER;
        var meta = dao.metadata("cron", "job");
        var notes = new ArrayList<String>();
        notes.add("cron_scope");
        if (!meta.readable()) {
            String availability = meta.exists() ? "forbidden" : "missing";
            notes.add("cron_" + availability);
            return response(source, availability, "unobservable", null, null, null, List.of(), notes);
        }
        boolean history;
        try { history = dao.metadata("cron", "job_run_details").readable(); }
        catch (RuntimeException error) { history = false; }
        List<Map<String, Object>> rows;
        try { rows = dao.jobs(history); }
        catch (RuntimeException error) {
            if (!history) throw error;
            history = false;
            rows = dao.jobs(false);
        }
        if (!history) notes.add("cron_history_unavailable");
        if (rows.size() > 100) notes.add("cron_truncated");
        var jobs = rows.stream().limit(100).map(row -> new Job(Objects.toString(row.get("jobid")), text(row, "jobname"),
                text(row, "schedule"), Boolean.TRUE.equals(row.get("active")), text(row, "last_status"), text(row, "started_at"), text(row, "finished_at"))).toList();
        String status = jobs.isEmpty() ? "unobservable" : !history || jobs.stream().anyMatch(job -> !job.active() || !"succeeded".equals(job.lastStatus())) ? "attention" : "ready";
        var runningStates = Set.of("running", "starting", "connecting", "sending");
        if (!jobs.isEmpty() && history && jobs.stream().allMatch(job -> job.active()
                && ("succeeded".equals(job.lastStatus()) || runningStates.contains(Objects.toString(job.lastStatus(), ""))))
                && jobs.stream().anyMatch(job -> runningStates.contains(Objects.toString(job.lastStatus(), "")))) status = "running";
        if (jobs.stream().anyMatch(job -> job.active() && "failed".equals(job.lastStatus()))) status = "failed";
        return response(source, "available", status, null, null, null, jobs, notes);
    }

    private DataProcessingResponse response(Source source, String availability, String status, Snapshot snapshot, Task task,
                                              Publication publication, List<Job> jobs, List<String> notes) {
        String health = switch (status) {
            case "ready" -> "healthy";
            case "failed", "inconsistent" -> "unavailable";
            case "running" -> "loading";
            default -> "gaps";
        };
        return new DataProcessingResponse(source.id, source.engine, source.mode, clock.instant().toString(), availability, status,
                health, source.job, source.schedule, snapshot, task, publication, List.copyOf(jobs),
                source == Source.SCHEDULER ? Arrays.stream(Source.values()).filter(item -> item.job != null)
                        .map(item -> new ExpectedJob(item.id, item.job, item.schedule, item.engine, item.mode)).toList() : List.of(), List.copyOf(notes));
    }
    private static String text(Map<String, Object> row, String key) { return row.get(key) == null ? null : row.get(key).toString(); }
    private static Integer integer(Map<String, Object> row, String key) { var value = number(row.get(key)); return value == null ? null : value.intValue(); }
}
