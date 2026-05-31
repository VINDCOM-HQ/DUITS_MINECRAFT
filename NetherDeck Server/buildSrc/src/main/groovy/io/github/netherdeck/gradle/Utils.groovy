package io.github.netherdeck.gradle

import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import java.util.function.Consumer

class Utils {

    private static File cacheDir = new File(System.getProperty('user.dir'), '.gradle/netherdeck/downloads')

    static void download(String url, File dist) {
        dist.parentFile.mkdirs()
        def con = new URL(url).openConnection()
        def stream = con.getInputStream()
        Files.copy(stream, dist.toPath(), StandardCopyOption.REPLACE_EXISTING)
        stream.close()
    }

    /**
     * Download with local cache fallback. On success the file is cached in
     * .gradle/netherdeck/downloads/ keyed by SHA-256 of the URL.
     * On failure, a cached copy is used if available; otherwise the error propagates.
     */
    static void downloadCached(String url, File dist) {
        cacheDir.mkdirs()
        def cacheKey = MessageDigest.getInstance('SHA-256')
                .digest(url.getBytes('UTF-8'))
                .collect { String.format '%02x', it }.join()
        def cachedFile = new File(cacheDir, cacheKey + '.jar')

        try {
            download(url, dist)
            // Update cache on success
            Files.copy(dist.toPath(), cachedFile.toPath(), StandardCopyOption.REPLACE_EXISTING)
        } catch (Exception e) {
            if (cachedFile.exists()) {
                System.err.println("[NetherDeck] Download failed for ${url}, using cached copy: ${e.message}")
                Files.copy(cachedFile.toPath(), dist.toPath(), StandardCopyOption.REPLACE_EXISTING)
            } else {
                throw new RuntimeException("Download failed for ${url} and no cached copy exists", e)
            }
        }
    }

    static <T extends AutoCloseable> void using(T closeable, Consumer<T> consumer) {
        try {
            consumer.accept(closeable)
        } finally {
            closeable.close()
        }
    }

    static void write(InputStream i, OutputStream o) {
        def buf = new byte[1024]
        def len = 0
        while ((len = i.read(buf)) > 0) {
            o.write(buf, 0, len)
        }
    }

    static String sha1(File file) {
        MessageDigest md = MessageDigest.getInstance('SHA-1')
        file.eachByte 4096, { bytes, size ->
            md.update(bytes, 0 as byte, size)
        }
        return md.digest().collect { String.format "%02x", it }.join()
    }
}
