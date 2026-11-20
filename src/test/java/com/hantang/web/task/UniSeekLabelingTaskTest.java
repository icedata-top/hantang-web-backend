package com.hantang.web.task;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hantang.web.api.LlmClient;
import com.hantang.web.api.LlmClient.*;
import com.hantang.web.service.labeling.VideoLabelingStore.*;
import com.hantang.web.support.InMemoryLabelingStore;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import java.net.InetSocketAddress;
import java.nio.file.*;
import java.sql.SQLException;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import static org.junit.jupiter.api.Assertions.*;

class UniSeekLabelingTaskTest {
    private static final ObjectMapper JSON = new ObjectMapper();
    @TempDir Path directory;
    private HttpServer server;
    private ExecutorService serverThreads;
    private final AtomicInteger calls = new AtomicInteger(), inFlight = new AtomicInteger(), peak = new AtomicInteger(), clients = new AtomicInteger();
    private final List<Long> requested = Collections.synchronizedList(new ArrayList<>());
    private CountDownLatch wave;
    private CountDownLatch arrived, release;
    private boolean failHttp;
    @BeforeEach void startServer() throws Exception {
        server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        serverThreads=Executors.newCachedThreadPool(); server.setExecutor(serverThreads);
        server.createContext("/chat/completions", exchange -> {
            int call=calls.incrementAndGet(); peak.accumulateAndGet(inFlight.incrementAndGet(),Math::max);
            try {
                var body=JSON.readTree(exchange.getRequestBody());
                var videos=JSON.readTree(body.path("messages").get(1).path("content").asText());
                if (wave!=null && call<=4) { wave.countDown(); if (!wave.await(5,TimeUnit.SECONDS)) throw new IllegalStateException("no overlap"); }
                if (arrived!=null) { arrived.countDown(); release.await(5,TimeUnit.SECONDS); }
                var labels=JSON.createArrayNode();
                for (JsonNode video:videos) {
                    long aid=video.path("aid").asLong(); requested.add(aid);
                    labels.addObject().put("aid",aid).put("is_song","是").put("is_virtual_singer","混合").putArray("languages").add("汉语");
                }
                var response=JSON.createObjectNode();
                response.putArray("choices").addObject().put("finish_reason","stop").putObject("message").put("content",labels.toString());
                response.putObject("usage").put("prompt_tokens",100).put("completion_tokens",30).put("total_tokens",130);
                byte[] bytes=response.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(failHttp?503:200,bytes.length); exchange.getResponseBody().write(bytes);
            } catch (Exception ignored) { }
            finally { inFlight.decrementAndGet(); exchange.close(); }
        }); server.start();
    }
    @AfterEach void close() { if(release!=null)release.countDown(); server.stop(0); serverThreads.shutdownNow(); }
    private LlmClient client() throws java.io.IOException {
        clients.incrementAndGet();
        Path config=directory.resolve("llm.properties");
        Files.writeString(config,"llm.model=test-qwen3\nllm.api_key=test-private-key\nllm.execution_tpm=100000000\nllm.base_url=http://127.0.0.1:"+server.getAddress().getPort()+"\n");
        return LlmClient.fromConfig(config);
    }
    private UniSeekLabelingTask task(InMemoryLabelingStore store,String mode,int count,int concurrency) throws Exception {
        String id="bulk-"+UUID.randomUUID();
        return new UniSeekLabelingTask(store,new Request(mode,count,concurrency),this::client,id,directory.resolve(id));
    }
    @Test void twoIncrementalRunsContinueFromCommittedLabelsAndOverwritePreservesManualLabels() throws Exception {
        var store=new InMemoryLabelingStore(80);
        store.sources.put(1L,"manual"); store.sources.put(2L,"llm");
        var first=task(store,"incremental",40,4); first.run();
        assertEquals("completed",first.snapshot().path("status").asText());
        assertEquals(40,first.snapshot().path("summary").path("succeeded_count").asInt());
        assertEquals(38,store.overview().unlabeled_count());
        var second=task(store,"incremental",20,4); second.run();
        assertEquals(18,store.overview().unlabeled_count());
        assertEquals(60,new HashSet<>(requested).size());
        assertFalse(requested.contains(1L)); assertFalse(requested.contains(2L));
        var overwrite=task(store,"overwrite",3,1); overwrite.run();
        assertEquals(3,overwrite.snapshot().path("summary").path("succeeded_count").asInt());
        assertTrue(requested.contains(2L)); assertFalse(requested.contains(1L));
        assertEquals("manual",store.sources.get(1L));
    }
    @Test void concurrencyIsBoundedAndBufferedInputsStayBoundedWhileAllRowsCommit() throws Exception {
        wave=new CountDownLatch(4);
        var store=new InMemoryLabelingStore(160);
        var task=task(store,"incremental",160,4); task.run();
        var state=task.snapshot();
        assertEquals("completed",state.path("status").asText());
        assertEquals(4,peak.get()); assertEquals(8,calls.get());
        assertEquals(160,state.path("summary").path("succeeded_count").asInt());
        assertEquals(1040,state.path("summary").path("reported_usage").path("total_tokens").asInt());
        assertTrue(state.path("buffered_batches").asInt()<=8);
        assertTrue(Files.size(task.directory().resolve("status.json"))<12000);
        assertEquals(160,store.labels.size()); assertEquals(0,store.overview().unlabeled_count());
        assertFalse(Files.readString(task.directory().resolve("attempts.jsonl")).contains("test-private-key"));
    }
    @Test void databaseFailureStopsBeforeCallingTheNextBatchAndNeverRetriesTheModel() throws Exception {
        var store=new InMemoryLabelingStore(40); store.failWrites=true; store.sources.put(1L,"llm");
        var task=task(store,"overwrite",40,1); task.run();
        var state=task.snapshot();
        assertEquals("failed",state.path("status").asText());
        assertEquals("DATABASE_WRITE_FAILED",state.path("fatal_error").path("code").asText());
        assertEquals(1,calls.get()); assertEquals(0,state.path("summary").path("succeeded_count").asInt());
        assertEquals(1,store.sources.size()); assertEquals("llm",store.sources.get(1L));
    }
    @Test void modelFailuresRetryTwiceAndLeaveCandidatesUnlabeled() throws Exception {
        failHttp=true;
        var store=new InMemoryLabelingStore(20); var task=task(store,"incremental",20,1); task.run();
        var state=task.snapshot();
        assertEquals("completed_with_failures",state.path("status").asText());
        assertEquals(3,calls.get()); assertEquals(20,state.path("summary").path("failed_count").asInt());
        assertEquals(2,state.path("summary").path("retry_count").asInt());
        assertEquals(390,state.path("summary").path("reported_usage").path("total_tokens").asInt());
        assertEquals(20,store.overview().unlabeled_count());
    }
    @Test void progressDoesNotAdvanceUntilTheDatabaseCommitReturns() throws Exception {
        var entered=new CountDownLatch(1); var commitGate=new CountDownLatch(1);
        var store=new InMemoryLabelingStore(20) {
            @Override public int save(List<VideoInput> videos,AnalysisResponse response,Context context) throws SQLException {
                entered.countDown();
                try { assertTrue(commitGate.await(5,TimeUnit.SECONDS)); } catch(InterruptedException e){throw new SQLException(e);}
                return super.save(videos,response,context);
            }
        };
        var task=task(store,"incremental",20,1); var thread=new Thread(task); thread.start();
        try {
            assertTrue(entered.await(3,TimeUnit.SECONDS));
            assertEquals(0,task.snapshot().path("summary").path("succeeded_count").asInt());
            assertEquals(20,store.overview().unlabeled_count());
        } finally { commitGate.countDown(); thread.join(5000); }
        assertEquals(20,task.snapshot().path("summary").path("succeeded_count").asInt());
    }
    @Test void stoppingCancelsInflightRequestsAndAllowsIncrementalContinuationWithoutPretendingTheyCommitted() throws Exception {
        arrived=new CountDownLatch(1); release=new CountDownLatch(1);
        var store=new InMemoryLabelingStore(100); var task=task(store,"incremental",100,1);
        var thread=new Thread(task); thread.start(); assertTrue(arrived.await(3,TimeUnit.SECONDS));
        task.requestStop(); thread.join(4000);
        assertFalse(thread.isAlive()); assertEquals("stopped",task.snapshot().path("status").asText());
        assertEquals(0,store.labels.size()); assertEquals(100,store.overview().unlabeled_count());
        assertEquals(100,task.snapshot().path("summary").path("pending_count").asInt());
    }
    @Test void anotherRunAndEmptySelectionsDoNotOpenAPaidClient() throws Exception {
        var store=new InMemoryLabelingStore(20); store.leased.set(true);
        var task=task(store,"incremental",20,1); task.run();
        assertEquals("ANOTHER_TASK_RUNNING",task.snapshot().path("fatal_error").path("code").asText());
        assertEquals(0,clients.get()); assertEquals(0,calls.get());
        var empty=task(new InMemoryLabelingStore(0),"incremental",20,1); empty.run();
        assertEquals("completed",empty.snapshot().path("status").asText()); assertEquals(0,clients.get());
    }
}
