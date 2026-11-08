package com.hantang.web.config;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/** Packaged from the frontend catalog by Maven; do not maintain a second name list. */
public final class UniSeekVocalCatalog {
    private static final Set<String> NAMES = loadNames();

    private UniSeekVocalCatalog() {}

    private static Set<String> loadNames() {
        try (var input = UniSeekVocalCatalog.class.getResourceAsStream("/config/vocal-search-info.json")) {
            if (input == null) throw new IllegalStateException("Missing UniSeek vocal catalog");
            var names = new HashSet<String>();
            for (var vocal : new ObjectMapper().readTree(input)) {
                names.add(normalize(vocal.required("name").asText()));
                for (var alias : vocal.required("aliases")) names.add(normalize(alias.asText()));
            }
            return Set.copyOf(names);
        } catch (IOException e) {
            throw new IllegalStateException("Cannot read UniSeek vocal catalog", e);
        }
    }

    private static String normalize(String value) { return value.strip().toLowerCase(Locale.ROOT); }

    public static boolean isExactName(String keyword) {
        return keyword != null && NAMES.contains(normalize(keyword));
    }
}
