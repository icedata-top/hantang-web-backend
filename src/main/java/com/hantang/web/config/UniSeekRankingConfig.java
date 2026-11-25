package com.hantang.web.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/** Exact singer names share the vocal catalog; extra CP/topic terms are explicitly curated. */
public final class UniSeekRankingConfig {
    private static final Settings SETTINGS = load();

    private record Settings(double defaultViewWeight, double popularityViewWeight, Set<String> popularityKeywords) {}

    private UniSeekRankingConfig() {}

    public static double viewWeight(String keyword) {
        boolean popularity = UniSeekVocalCatalog.isExactName(keyword)
                || (keyword != null && SETTINGS.popularityKeywords().contains(normalize(keyword)));
        return popularity ? SETTINGS.popularityViewWeight() : SETTINGS.defaultViewWeight();
    }

    private static Settings load() {
        try (var input = UniSeekRankingConfig.class.getResourceAsStream("/config/uniseek-ranking.json")) {
            if (input == null) throw new IllegalStateException("Missing UniSeek ranking config");
            var root = new ObjectMapper().readTree(input);
            double normal = weight(root, "defaultViewWeight");
            double popularity = weight(root, "popularityViewWeight");
            if (popularity < normal) throw new IllegalStateException("Popularity weight must be at least the default weight");
            var entries = root.required("popularityKeywords");
            if (!entries.isArray()) throw new IllegalStateException("UniSeek popularityKeywords must be an array");
            var keywords = new HashSet<String>();
            for (var entry : entries) {
                if (!entry.isTextual() || entry.asText().isBlank())
                    throw new IllegalStateException("UniSeek popularity keywords must be nonblank strings");
                keywords.add(normalize(entry.asText()));
            }
            return new Settings(normal, popularity, Set.copyOf(keywords));
        } catch (IOException | IllegalArgumentException e) {
            throw new IllegalStateException("Cannot read UniSeek ranking config", e);
        }
    }

    private static double weight(JsonNode root, String key) {
        var value = root.required(key);
        double weight = value.asDouble();
        if (!value.isNumber() || !Double.isFinite(weight) || weight <= 0)
            throw new IllegalStateException("UniSeek " + key + " must be a positive finite number");
        return weight;
    }

    private static String normalize(String value) { return value.strip().toLowerCase(Locale.ROOT); }
}
