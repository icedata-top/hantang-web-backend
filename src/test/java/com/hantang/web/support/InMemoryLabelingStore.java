package com.hantang.web.support;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hantang.web.api.LlmClient.*;
import com.hantang.web.service.labeling.VideoLabelingStore;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.SQLException;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;

public class InMemoryLabelingStore implements VideoLabelingStore {
    private static final ObjectMapper JSON = new ObjectMapper();
    public final List<VideoInput> source = new ArrayList<>();
    public final Map<Long, String> sources = new HashMap<>();
    public final Map<Long, VideoLabel> labels = new HashMap<>();
    public final List<Long> committed = new ArrayList<>();
    public boolean failWrites, schemaMissing;
    public SQLException overviewFailure;
    public final AtomicBoolean leased = new AtomicBoolean();
    public InMemoryLabelingStore(int count) { for (long i=1;i<=count;i++) source.add(new VideoInput(i,"视频"+i,List.of("标签"),"简介")); }
    @Override public synchronized Overview overview() throws SQLException {
        if (schemaMissing) throw new SQLException("missing table", "42P01");
        if (overviewFailure != null) throw overviewFailure;
        long labeled = source.stream().filter(v -> sources.containsKey(v.aid())).count();
        long manual = source.stream().filter(v -> "manual".equals(sources.get(v.aid()))).count();
        return new Overview(source.size(),labeled,source.size()-labeled,manual,0,0);
    }
    @Override public Lease acquire() throws SQLException {
        if (!leased.compareAndSet(false,true)) throw new SQLException("busy","55P03");
        return new Lease() {
            public void verify() throws SQLException { if (!leased.get()) throw new SQLException("lock lost"); }
            public void close() { leased.set(false); }
        };
    }
    @Override public synchronized Selection prepare(Request request, Path file) throws IOException {
        var selected = source.stream().filter(v -> request.mode().equals("incremental") ? !sources.containsKey(v.aid())
                : !"manual".equals(sources.get(v.aid()))).sorted(Comparator.comparingLong(VideoInput::aid)).limit(request.count()).toList();
        try (var writer = Files.newBufferedWriter(file)) {
            for (int i=0;i<selected.size();i+=20) { writer.write(JSON.writeValueAsString(selected.subList(i,Math.min(i+20,selected.size())))); writer.newLine(); }
        }
        return new Selection(selected.size(),"source-batch","2026-11-20");
    }
    @Override public synchronized int save(List<VideoInput> videos, AnalysisResponse response, Context context) throws SQLException {
        if (failWrites) throw new SQLException("simulated write permission failure", "42501");
        int count=0;
        for (int i=0;i<videos.size();i++) {
            long aid=videos.get(i).aid();
            if (context.mode().equals("incremental") && sources.containsKey(aid) || "manual".equals(sources.get(aid))) continue;
            sources.put(aid,"llm"); labels.put(aid,response.results().get(i)); committed.add(aid); count++;
        }
        return count;
    }
}
