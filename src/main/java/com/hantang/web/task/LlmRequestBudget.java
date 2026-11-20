package com.hantang.web.task;

import java.util.ArrayDeque;

/** A single run shares a rolling admission budget; unknown usage retains its reservation. */
final class LlmRequestBudget {
    static final class Reservation {
        final long atMs;
        long tokens;
        Reservation(long atMs, long tokens) { this.atMs = atMs; this.tokens = tokens; }
    }
    private final long tpm;
    private final int rpm;
    private final ArrayDeque<Reservation> requests = new ArrayDeque<>();

    LlmRequestBudget(long tpm, int rpm) { this.tpm = tpm; this.rpm = rpm; }

    long waitMs(long now, long estimate) {
        if (estimate > tpm) throw new IllegalArgumentException("单批预估用量超过本次执行TPM预算");
        while (!requests.isEmpty() && requests.peek().atMs <= now - 60_000) requests.remove();
        long tokens = 0;
        for (var request : requests) tokens += request.tokens;
        int count = requests.size();
        for (var request : requests) {
            if (count < rpm && tokens + estimate <= tpm) return 0;
            tokens -= request.tokens;
            count--;
            if (count < rpm && tokens + estimate <= tpm) return Math.max(1, request.atMs + 60_000 - now);
        }
        return 0;
    }

    Reservation reserve(long now, long estimate) {
        var request = new Reservation(now, estimate);
        requests.add(request);
        return request;
    }

    void reconcile(Reservation request, Long actual) {
        if (actual != null) request.tokens = actual;
    }
}
