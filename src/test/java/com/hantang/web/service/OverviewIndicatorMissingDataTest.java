package com.hantang.web.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hantang.web.dos.overview.OverviewIndicatorsResponse;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class OverviewIndicatorMissingDataTest {
    @Test
    void missingEitherEndpointDoesNotProduceDelta() {
        assertNull(OverviewService.difference(null, 100L));
        assertNull(OverviewService.difference(100L, null));
        assertNull(OverviewService.difference(null, null));
        assertEquals(0L, OverviewService.difference(100L, 100L));
        assertEquals(50L, OverviewService.difference(150L, 100L));
        assertEquals(-10L, OverviewService.difference(90L, 100L));
        assertEquals(100L, OverviewService.difference(100L, 0L));
    }

    @Test
    void comparisonNeedsBothRangesAndNonZeroBase() {
        assertNull(OverviewService.nullableRatio(null, 10L));
        assertNull(OverviewService.nullableRatio(10L, null));
        assertNull(OverviewService.nullableRatio(10L, 0L));
        assertNull(OverviewService.nullableRatio(0L, 0L));
        assertEquals(-1.0, OverviewService.nullableRatio(0L, 10L));
        assertEquals(0.5, OverviewService.nullableRatio(15L, 10L));
    }

    @Test
    void responseDistinguishesMissingFromRealZero() throws Exception {
        var response = new OverviewIndicatorsResponse(List.of(
                new OverviewIndicatorsResponse.Indicator("view", null, null),
                new OverviewIndicatorsResponse.Indicator("favorite", 0L, null)
        ));
        var mapper = new ObjectMapper();
        var rows = mapper.readTree(mapper.writeValueAsString(response)).get("indicators");
        assertTrue(rows.get(0).get("value").isNull());
        assertTrue(rows.get(0).get("dod").isNull());
        assertEquals(0L, rows.get(1).get("value").longValue());
    }
}
