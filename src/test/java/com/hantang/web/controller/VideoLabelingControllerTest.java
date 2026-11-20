package com.hantang.web.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hantang.web.support.InMemoryLabelingStore;
import com.hantang.web.service.labeling.VideoLabelingStore.*;
import com.hantang.web.task.UniSeekLabelingTask;
import io.javalin.Javalin;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import java.net.URI;
import java.net.http.*;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;

class VideoLabelingControllerTest {
    private static final ObjectMapper JSON=new ObjectMapper();
    @TempDir Path directory;
    private Javalin app;
    private final ArrayList<Runnable> queued=new ArrayList<>();
    private final AtomicInteger clients=new AtomicInteger();
    private void start(InMemoryLabelingStore store) {
        app=Javalin.create();
        new VideoLabelingController(store,directory,queued::add,()->{clients.incrementAndGet();throw new java.io.IOException("unexpected paid client");}).registerRoutes(app);
        app.start("127.0.0.1",0);
    }
    @AfterEach void close(){if(app!=null)app.stop();}
    private HttpResponse<String> request(String method,String path,String body,String...headers) throws Exception {
        var builder=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+app.port()+"/admin/content/video-labeling"+path));
        if(headers.length>0)builder.headers(headers);
        builder.method(method,body==null?HttpRequest.BodyPublishers.noBody():HttpRequest.BodyPublishers.ofString(body));
        try(var client=HttpClient.newHttpClient()){return client.send(builder.build(),HttpResponse.BodyHandlers.ofString());}
    }
    @Test void gettersOnlyReadAndExplicitStartValidatesCountModeAndConcurrency() throws Exception {
        start(new InMemoryLabelingStore(200000));
        assertEquals("idle",JSON.readTree(request("GET","",null).body()).path("result").path("status").asText());
        assertEquals(200000,JSON.readTree(request("GET","/overview",null).body()).path("result").path("unlabeled_count").asInt());
        assertTrue(queued.isEmpty());assertEquals(0,clients.get());
        for(String body:new String[]{"", "null", "[]", "{}", "{\"mode\":\"incremental\",\"count\":200001,\"concurrency\":8}",
          "{\"mode\":\"all\",\"count\":10000,\"concurrency\":8}", "{\"mode\":\"incremental\",\"count\":1.5,\"concurrency\":8}",
          "{\"mode\":\"incremental\",\"count\":10000,\"concurrency\":3}"})
            assertEquals(400,request("POST","/start",body).statusCode(),body);
        assertTrue(queued.isEmpty());
        assertEquals(202,request("POST","/start","{\"mode\":\"incremental\",\"count\":10000,\"concurrency\":16}").statusCode());
        var state=JSON.readTree(request("GET","",null).body()).path("result");
        assertEquals(10000,state.path("requested_count").asInt());assertEquals(16,state.path("concurrency").asInt());
        assertEquals("incremental",state.path("mode").asText());assertEquals(0,clients.get());
        assertEquals(409,request("POST","/start","{\"mode\":\"overwrite\",\"count\":20000,\"concurrency\":8}").statusCode());
        assertEquals(202,request("POST","/stop",null).statusCode());
        queued.getFirst().run();assertEquals(0,clients.get());
        assertEquals("stopped",JSON.readTree(request("GET","",null).body()).path("result").path("status").asText());
        assertEquals(200,request("GET","/statistics",null).statusCode());assertEquals(404,request("GET","/config.secret.properties",null).statusCode());
    }
    @Test void schemaMissingPreventsAnyQueuedJobOrPaidConfiguration() throws Exception {
        var store=new InMemoryLabelingStore(20);store.schemaMissing=true;start(store);
        var overview=JSON.readTree(request("GET","/overview",null).body()).path("result");
        assertFalse(overview.path("available").asBoolean());assertEquals("DATABASE_SCHEMA_NOT_READY",overview.path("error").asText());
        assertEquals(503,request("POST","/start","{\"mode\":\"incremental\",\"count\":20,\"concurrency\":1}").statusCode());
        assertTrue(queued.isEmpty());assertEquals(0,clients.get());
    }
    @Test void missingSelectPermissionIsReportedAccuratelyAndPreventsPaidWork() throws Exception {
        var store=new InMemoryLabelingStore(20);
        store.overviewFailure=new java.sql.SQLException("permission denied for table video_content_labels", "42501");start(store);
        var overview=JSON.readTree(request("GET","/overview",null).body()).path("result");
        assertFalse(overview.path("available").asBoolean());
        assertEquals("DATABASE_PERMISSION_DENIED",overview.path("error").asText());
        var response=request("POST","/start","{\"mode\":\"incremental\",\"count\":20,\"concurrency\":1}");
        assertEquals(503,response.statusCode());
        assertEquals("DATABASE_PERMISSION_DENIED",JSON.readTree(response.body()).path("msg").asText());
        assertTrue(queued.isEmpty());assertEquals(0,clients.get());
    }
    @Test void connectionTimeoutAndOtherSqlFailuresHaveDistinctDiagnostics() throws Exception {
        for (var failure : java.util.Map.of("08006","DATABASE_UNAVAILABLE", "57014","DATABASE_QUERY_TIMEOUT", "42601","DATABASE_QUERY_FAILED").entrySet()) {
            var store=new InMemoryLabelingStore(20);
            store.overviewFailure=new java.sql.SQLException("simulated SQL failure",failure.getKey());start(store);
            var overview=JSON.readTree(request("GET","/overview",null).body()).path("result");
            assertEquals(failure.getValue(),overview.path("error").asText());
            assertTrue(queued.isEmpty());assertEquals(0,clients.get());
            app.stop();app=null;
        }
    }
    @Test void restartRestoresInterruptedStatusButNeverSchedulesOrCallsAModel() throws Exception {
        start(new InMemoryLabelingStore(20));
        request("POST","/start","{\"mode\":\"overwrite\",\"count\":20,\"concurrency\":4}");
        app.stop();queued.clear();start(new InMemoryLabelingStore(20));
        var state=JSON.readTree(request("GET","",null).body()).path("result");
        assertFalse(state.path("active").asBoolean());assertEquals("interrupted",state.path("status").asText());
        assertEquals("overwrite",state.path("mode").asText());assertEquals(4,state.path("concurrency").asInt());
        assertTrue(queued.isEmpty());assertEquals(0,clients.get());
    }
    @Test void forwardedAndForeignRequestsCannotStartOrStopJobs() throws Exception {
        start(new InMemoryLabelingStore(20));String body="{\"mode\":\"incremental\",\"count\":20,\"concurrency\":4}";
        assertEquals(403,request("POST","/start",body,"Origin","https://example.invalid").statusCode());
        assertEquals(403,request("POST","/start",body,"X-Forwarded-For","203.0.113.1").statusCode());
        assertEquals(403,request("POST","/stop",null,"Origin","https://example.invalid").statusCode());
        assertTrue(queued.isEmpty());
    }
}
