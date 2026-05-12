package com.finchi;

import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.SocketException;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Executors;

public class FinchiApplication {
    private static final int DEFAULT_PORT = 8080;
    private static final Path DATA_DIR = resolveDataDir();
    private static final Path ACCOUNTS_DIR = DATA_DIR.resolve("accounts");
    private static final Path AI_DIR = DATA_DIR.resolve("ai");
    private static final Path STUDENT_EVENTS_DIR = AI_DIR.resolve("student-events");
    private static final Path PARENT_EVENTS_DIR = AI_DIR.resolve("parent-events");
    private static final Path STUDENT_STATE_DIR = AI_DIR.resolve("student-state");
    private static final Path AI_INTERVENTIONS_DIR = AI_DIR.resolve("interventions");
    private static final Path AI_CORRECTION_DIR = AI_DIR.resolve("corrections");
    private static final Path CORRECTION_FEEDBACK_DIR = AI_CORRECTION_DIR.resolve("feedback");
    private static final Path VERIFICATION_RESULTS_DIR = AI_CORRECTION_DIR.resolve("verifications");
    private static final Path LEARNING_MEMORY_DIR = AI_CORRECTION_DIR.resolve("learning-memory");
    private static final Path RUBRIC_PATCHES_DIR = AI_CORRECTION_DIR.resolve("rubric-patches");
    private static final Path APPLIED_RUBRICS_DIR = AI_CORRECTION_DIR.resolve("applied-rubrics");
    private static final Path CORRECTION_AUDIT_DIR = AI_CORRECTION_DIR.resolve("audit");

    public static void main(String[] args) throws IOException {
        ensureDataDirs();

        int port = resolvePort(args);

        HttpServer server = HttpServer.create(new InetSocketAddress("0.0.0.0", port), 0);
        server.createContext("/api/health", new HealthHandler());
        server.createContext("/api/auth/signup", new SignupHandler());
        server.createContext("/api/auth/login", new LoginHandler());
        server.createContext("/api/auth/parent-signup", new ParentSignupHandler());
        server.createContext("/api/auth/parent-login", new ParentLoginHandler());
        server.createContext("/api/player/load", new LoadPlayerHandler());
        server.createContext("/api/player/save", new SavePlayerHandler());
        server.createContext("/api/leaderboard", new LeaderboardHandler());
        server.createContext("/api/clans", new ClanListHandler());
        server.createContext("/api/events/student", new StudentEventHandler());
        server.createContext("/api/events/parent", new ParentEventHandler());
        server.createContext("/api/ai/intervention", new AiInterventionHandler());
        server.createContext("/api/ai/correction-feedback", new CorrectionFeedbackHandler());
        server.createContext("/api/ai/verify-answer", new VerifyAnswerHandler());
        server.createContext("/api/voice/generate", new VoicePolicyHandler());
        server.createContext("/api/admin/correction-feedback", new AdminCorrectionFeedbackHandler());
        server.createContext("/api/admin/rubric-patches", new AdminRubricPatchHandler());
        server.createContext("/api/admin/import-account", new AdminImportAccountHandler());
        server.createContext("/api/student/", new StudentLearningStateHandler());
        server.createContext("/api/parent/", new ParentContextSummaryHandler());
        server.createContext("/", new StaticFileHandler());
        server.setExecutor(Executors.newFixedThreadPool(8));
        server.start();

        printBanner(port);
    }

    private static Path resolveDataDir() {
        String configured = System.getenv("DATA_DIR");
        if (configured != null && !configured.isBlank()) {
            return Path.of(configured.trim());
        }
        String railwayVolumePath = System.getenv("RAILWAY_VOLUME_MOUNT_PATH");
        if (railwayVolumePath != null && !railwayVolumePath.isBlank()) {
            return Path.of(railwayVolumePath.trim());
        }
        return Path.of("server-data");
    }

    private static int resolvePort(String[] args) {
        if (args != null && args.length > 0) {
            try {
                return Integer.parseInt(args[0]);
            } catch (NumberFormatException ignored) {
                System.out.println("Port từ tham số không hợp lệ, kiểm tra biến môi trường PORT...");
            }
        }

        String envPort = System.getenv("PORT");
        if (envPort != null && !envPort.isBlank()) {
            try {
                return Integer.parseInt(envPort.trim());
            } catch (NumberFormatException ignored) {
                System.out.println("Biến môi trường PORT không hợp lệ, dùng mặc định 8080.");
            }
        }

        return DEFAULT_PORT;
    }

    private static void ensureDataDirs() throws IOException {
        Files.createDirectories(ACCOUNTS_DIR);
        Files.createDirectories(STUDENT_EVENTS_DIR);
        Files.createDirectories(PARENT_EVENTS_DIR);
        Files.createDirectories(STUDENT_STATE_DIR);
        Files.createDirectories(AI_INTERVENTIONS_DIR);
        Files.createDirectories(CORRECTION_FEEDBACK_DIR);
        Files.createDirectories(VERIFICATION_RESULTS_DIR);
        Files.createDirectories(LEARNING_MEMORY_DIR);
        Files.createDirectories(RUBRIC_PATCHES_DIR);
        Files.createDirectories(APPLIED_RUBRICS_DIR);
        Files.createDirectories(CORRECTION_AUDIT_DIR);
        normalizeAccountFiles();
    }

    private static void printBanner(int port) {
        List<String> lanUrls = buildLanUrls(port);
        String localUrl = "http://localhost:" + port;
        String healthUrl = localUrl + "/api/health";

        System.out.println();
        System.out.println("====================================================");
        System.out.println("                    FINCHI EDU");
        System.out.println("====================================================");
        System.out.println("Mở ngay trên máy này:");
        System.out.println("  " + localUrl + "/");
        System.out.println("Kiểm tra server:");
        System.out.println("  " + healthUrl);

        if (!lanUrls.isEmpty()) {
            System.out.println("Mở từ thiết bị khác cùng mạng Wi‑Fi/LAN:");
            for (String url : lanUrls) {
                System.out.println("  " + url);
            }
        }

        System.out.println("Nhấn Ctrl + C để dừng server.");
        System.out.println("====================================================");
        System.out.println();
    }

    private static List<String> buildLanUrls(int port) {
        Set<String> urls = new LinkedHashSet<>();
        try {
            for (NetworkInterface networkInterface : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!networkInterface.isUp() || networkInterface.isLoopback() || networkInterface.isVirtual()) {
                    continue;
                }
                for (InetAddress address : Collections.list(networkInterface.getInetAddresses())) {
                    if (address instanceof Inet4Address ipv4 && !ipv4.isLoopbackAddress()) {
                        String ip = ipv4.getHostAddress();
                        if (!ip.startsWith("169.254.")) {
                            urls.add("http://" + ip + ":" + port + "/");
                        }
                    }
                }
            }
        } catch (SocketException ignored) {
        }
        return new ArrayList<>(urls);
    }

    private static Path accountFile(String username) {
        return ACCOUNTS_DIR.resolve(username.toLowerCase(Locale.ROOT) + ".properties");
    }

    private static boolean isValidUsername(String username) {
        return username != null && username.matches("[A-Za-z0-9_]{3,24}");
    }

    private static boolean isSupportedUsername(String username) {
        if (username == null) {
            return false;
        }
        String value = username.trim();
        if (value.isBlank() || value.length() > 64 || value.contains("..")) {
            return false;
        }
        String blocked = "/\\:*?\"<>|";
        for (int i = 0; i < value.length(); i++) {
            char ch = value.charAt(i);
            if (ch < 32 || blocked.indexOf(ch) >= 0) {
                return false;
            }
        }
        return true;
    }

    private static void normalizeAccountFiles() throws IOException {
        if (!Files.exists(ACCOUNTS_DIR)) {
            return;
        }
        try (var stream = Files.list(ACCOUNTS_DIR)) {
            for (Path file : stream.filter(path -> path.getFileName().toString().endsWith(".properties")).toList()) {
                String filename = file.getFileName().toString();
                String username = filename.substring(0, filename.length() - ".properties".length());
                Path canonical = accountFile(username);
                if (!Files.exists(canonical)) {
                    try {
                        Files.move(file, canonical);
                    } catch (IOException ignored) {
                    }
                }
            }
        }
    }

    private static Path resolveAccountFile(String username) throws IOException {
        Path canonical = accountFile(username);
        if (Files.exists(canonical) || !Files.exists(ACCOUNTS_DIR)) {
            return canonical;
        }
        try (var stream = Files.list(ACCOUNTS_DIR)) {
            for (Path file : stream.filter(path -> path.getFileName().toString().endsWith(".properties")).toList()) {
                String filename = file.getFileName().toString();
                String currentUsername = filename.substring(0, filename.length() - ".properties".length());
                if (!currentUsername.equalsIgnoreCase(username)) {
                    continue;
                }
                if (!Files.exists(canonical)) {
                    try {
                        Files.move(file, canonical);
                        return canonical;
                    } catch (IOException ignored) {
                    }
                }
                return file;
            }
        }
        return canonical;
    }

    private static Properties loadAccount(String username) throws IOException {
        Properties props = new Properties();
        Path file = resolveAccountFile(username);
        if (Files.exists(file)) {
            try (InputStream input = Files.newInputStream(file)) {
                props.load(input);
            }
        }
        return props;
    }

    private static void saveAccount(String username, Properties props) throws IOException {
        try (OutputStream output = Files.newOutputStream(accountFile(username))) {
            props.store(output, "Finchi account");
        }
    }

    private static Path studentEventFile(String username) {
        return STUDENT_EVENTS_DIR.resolve(username.toLowerCase(Locale.ROOT) + ".log");
    }

    private static Path parentEventFile(String username) {
        return PARENT_EVENTS_DIR.resolve(username.toLowerCase(Locale.ROOT) + ".log");
    }

    private static Path studentStateFile(String username) {
        return STUDENT_STATE_DIR.resolve(username.toLowerCase(Locale.ROOT) + ".properties");
    }

    private static Path interventionFile(String username) {
        return AI_INTERVENTIONS_DIR.resolve(username.toLowerCase(Locale.ROOT) + ".log");
    }

    private static Properties loadProperties(Path file) throws IOException {
        Properties props = new Properties();
        if (Files.exists(file)) {
            try (InputStream input = Files.newInputStream(file)) {
                props.load(input);
            }
        }
        return props;
    }

    private static void saveProperties(Path file, Properties props, String comment) throws IOException {
        try (OutputStream output = Files.newOutputStream(file)) {
            props.store(output, comment);
        }
    }

    private static void appendLog(Path file, String line) throws IOException {
        Files.writeString(
                file,
                line + System.lineSeparator(),
                StandardCharsets.UTF_8,
                StandardOpenOption.CREATE,
                StandardOpenOption.APPEND
        );
    }

    private static String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder();
            for (byte b : hash) builder.append(String.format("%02x", b));
            return builder.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static Map<String, String> parseForm(HttpExchange exchange) throws IOException {
        String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        Map<String, String> result = new LinkedHashMap<>();
        if (body.isBlank()) return result;
        for (String pair : body.split("&")) {
            if (pair.isBlank()) continue;
            String[] parts = pair.split("=", 2);
            String key = URLDecoder.decode(parts[0], StandardCharsets.UTF_8);
            String value = parts.length > 1 ? URLDecoder.decode(parts[1], StandardCharsets.UTF_8) : "";
            result.put(key, value);
        }
        return result;
    }

    private static Map<String, String> parseQuery(URI uri) {
        Map<String, String> result = new LinkedHashMap<>();
        String query = uri.getRawQuery();
        if (query == null || query.isBlank()) return result;
        for (String pair : query.split("&")) {
            if (pair.isBlank()) continue;
            String[] parts = pair.split("=", 2);
            String key = URLDecoder.decode(parts[0], StandardCharsets.UTF_8);
            String value = parts.length > 1 ? URLDecoder.decode(parts[1], StandardCharsets.UTF_8) : "";
            result.put(key, value);
        }
        return result;
    }

    private static String jsonEscape(String value) {
        if (value == null) return "";
        return value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r");
    }

    private static int parseInt(String value, int fallback) {
        try {
            return Integer.parseInt(String.valueOf(value).trim());
        } catch (Exception ignored) {
            return fallback;
        }
    }

    private static boolean parseBoolean(String value) {
        return "true".equalsIgnoreCase(String.valueOf(value).trim());
    }

    private static void copyIfPresent(Properties target, Map<String, String> form, String key) {
        if (form.containsKey(key)) {
            target.setProperty(key, form.getOrDefault(key, ""));
        }
    }

    private static void updateAiState(Properties props, Map<String, String> form) {
        props.setProperty("lastUpdatedAt", Instant.now().toString());
        copyIfPresent(props, form, "playerName");
        copyIfPresent(props, form, "parentName");
        copyIfPresent(props, form, "currentPage");
        copyIfPresent(props, form, "currentLesson");
        copyIfPresent(props, form, "currentMission");
        copyIfPresent(props, form, "currentLevelId");
        copyIfPresent(props, form, "questionId");
        copyIfPresent(props, form, "questionPrompt");
        copyIfPresent(props, form, "selectedAnswer");
        copyIfPresent(props, form, "isCorrect");
        copyIfPresent(props, form, "attemptCount");
        copyIfPresent(props, form, "hintUsed");
        copyIfPresent(props, form, "timeOnQuestion");
        copyIfPresent(props, form, "skillTag");
        copyIfPresent(props, form, "correctStreak");
        copyIfPresent(props, form, "mistakeCountSkill");
        copyIfPresent(props, form, "mistakePattern");
        copyIfPresent(props, form, "emotionSignal");
        copyIfPresent(props, form, "weakSkill");
        copyIfPresent(props, form, "weakLevel");
        copyIfPresent(props, form, "childProgressStatus");
        copyIfPresent(props, form, "todayStudySeconds");
        copyIfPresent(props, form, "todayQuestions");
        copyIfPresent(props, form, "todayCorrect");
        copyIfPresent(props, form, "completedLevelsCount");
        copyIfPresent(props, form, "eventType");
        String eventType = form.getOrDefault("eventType", "").trim();
        if (!eventType.isBlank()) {
            props.setProperty("lastEventType", eventType);
        }
        if ("student_answer_submitted".equals(eventType)) {
            props.setProperty(
                    "submittedAnswerCount",
                    String.valueOf(parseInt(props.getProperty("submittedAnswerCount", "0"), 0) + 1)
            );
            if (parseBoolean(form.getOrDefault("isCorrect", "false"))) {
                props.setProperty(
                        "submittedCorrectCount",
                        String.valueOf(parseInt(props.getProperty("submittedCorrectCount", "0"), 0) + 1)
                );
            }
        }
        if ("parent_opened_report".equals(eventType)) {
            props.setProperty(
                    "parentReportViews",
                    String.valueOf(parseInt(props.getProperty("parentReportViews", "0"), 0) + 1)
            );
        }
        if ("parent_viewed_mistake_detail".equals(eventType)) {
            props.setProperty(
                    "parentMistakeViews",
                    String.valueOf(parseInt(props.getProperty("parentMistakeViews", "0"), 0) + 1)
            );
        }
    }

    private static String buildParentSummaryMessage(Properties props) {
        String weakSkill = props.getProperty("weakSkill", "").trim();
        int studySeconds = parseInt(props.getProperty("todayStudySeconds", "0"), 0);
        int questions = parseInt(props.getProperty("todayQuestions", "0"), 0);
        int correct = parseInt(props.getProperty("todayCorrect", "0"), 0);
        int minutes = Math.max(1, Math.round(studySeconds / 60f));
        if (!weakSkill.isBlank()) {
            return "Hôm nay con học " + minutes + " phút, làm đúng " + correct + "/" + questions
                    + " câu. Hiện con đang cần hỗ trợ thêm ở kỹ năng " + weakSkill.toLowerCase(Locale.ROOT) + ".";
        }
        return "Hôm nay con học " + minutes + " phút, làm đúng " + correct + "/" + questions
                + " câu. Hiện con đang giữ nhịp học ổn định và chưa có kỹ năng yếu rõ rệt.";
    }

    private static String buildParentHomeActivity(Properties props) {
        String weakSkill = props.getProperty("weakSkill", "").trim();
        String weakLevel = props.getProperty("weakLevel", "").trim();
        if (!weakSkill.isBlank()) {
            return "Buổi tối, hãy cho con giải thích bằng lời một tình huống ngắn về "
                    + weakSkill.toLowerCase(Locale.ROOT)
                    + " để con luyện tư duy chậm và chắc.";
        }
        if (!weakLevel.isBlank()) {
            return "Buổi tối, hãy hỏi con kể lại một điều học được từ " + weakLevel.toLowerCase(Locale.ROOT) + ".";
        }
        return "Phụ huynh có thể giữ nhịp học đều và hỏi con điều mới học được hôm nay để củng cố kiến thức.";
    }

    private static String buildParentSummaryJson(Properties props) {
        return "{"
                + "\"summaryMessage\":\"" + jsonEscape(buildParentSummaryMessage(props)) + "\","
                + "\"homeActivity\":\"" + jsonEscape(buildParentHomeActivity(props)) + "\","
                + "\"supportStatus\":\"" + jsonEscape(props.getProperty("childProgressStatus", "on_track")) + "\","
                + "\"weakSkill\":\"" + jsonEscape(props.getProperty("weakSkill", "")) + "\","
                + "\"weakLevel\":\"" + jsonEscape(props.getProperty("weakLevel", "")) + "\""
                + "}";
    }

    private static String safeAiMessage(String message) {
        if (message == null || message.isBlank()) {
            return "FINCHI luôn hỗ trợ con trong phạm vi bài học hiện tại nhé.";
        }
        String safe = message
                .replace("kiếm tiền nhanh", "học tài chính an toàn")
                .replace("vay nợ", "quản lý tài chính an toàn")
                .replace("đầu tư ngoài đời", "khái niệm đầu tư trong bài học")
                .replace('\n', ' ')
                .replace('\r', ' ')
                .trim();
        return safe.length() > 220 ? safe.substring(0, 217).trim() + "..." : safe;
    }

    private static String newId(String prefix) {
        return prefix + "-" + Instant.now().toEpochMilli() + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private static Path correctionFeedbackFile(String id) {
        return CORRECTION_FEEDBACK_DIR.resolve(id + ".properties");
    }

    private static Path verificationResultFile(String id) {
        return VERIFICATION_RESULTS_DIR.resolve(id + ".properties");
    }

    private static Path learningMemoryFile(String id) {
        return LEARNING_MEMORY_DIR.resolve(id + ".properties");
    }

    private static Path rubricPatchFile(String id) {
        return RUBRIC_PATCHES_DIR.resolve(id + ".properties");
    }

    private static Path appliedRubricFile(String lessonId, String questionId) {
        return APPLIED_RUBRICS_DIR.resolve((lessonId + "__" + questionId).replaceAll("[^A-Za-z0-9_\\-]", "_") + ".properties");
    }

    private static Path correctionAuditFile() {
        return CORRECTION_AUDIT_DIR.resolve("audit.log");
    }

    private static String joinKeywords(List<String> keywords) {
        return String.join("|", keywords);
    }

    private static List<String> splitKeywords(String raw) {
        if (raw == null || raw.isBlank()) return new ArrayList<>();
        List<String> items = new ArrayList<>();
        for (String token : raw.split("\\|")) {
            String trimmed = token.trim().toLowerCase(Locale.ROOT);
            if (!trimmed.isBlank() && !items.contains(trimmed)) items.add(trimmed);
        }
        return items;
    }

    private static List<String> tokenizeKeywords(String raw) {
        if (raw == null || raw.isBlank()) return new ArrayList<>();
        String normalized = raw
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();
        if (normalized.isBlank()) return new ArrayList<>();

        Set<String> stopwords = Set.of(
                "con", "bé", "em", "là", "vì", "và", "nên", "cho", "của", "các", "một", "những",
                "đang", "khi", "để", "với", "trong", "này", "kia", "thì", "đó", "đây", "rằng"
        );

        List<String> tokens = new ArrayList<>();
        String[] parts = normalized.split(" ");
        for (String part : parts) {
            String cleaned = part.trim();
            if (cleaned.length() < 3 || stopwords.contains(cleaned) || tokens.contains(cleaned)) continue;
            tokens.add(cleaned);
        }
        for (int i = 0; i < parts.length - 1; i++) {
            String first = parts[i].trim();
            String second = parts[i + 1].trim();
            if (first.length() < 3 || second.length() < 3) continue;
            if (stopwords.contains(first) || stopwords.contains(second)) continue;
            String bigram = first + " " + second;
            if (!tokens.contains(bigram)) tokens.add(bigram);
        }
        return tokens;
    }

    private static boolean containsAny(String text, List<String> keywords) {
        if (text == null || text.isBlank() || keywords == null || keywords.isEmpty()) return false;
        String normalized = text.toLowerCase(Locale.ROOT);
        for (String keyword : keywords) {
            if (!keyword.isBlank() && normalized.contains(keyword.toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }

    private static List<String> getPositiveKeywords(Map<String, String> form) throws IOException {
        String skillTag = form.getOrDefault("skillTag", "").toLowerCase(Locale.ROOT);
        String lesson = form.getOrDefault("currentLesson", "").toLowerCase(Locale.ROOT);
        String question = form.getOrDefault("questionPrompt", "").toLowerCase(Locale.ROOT);
        List<String> keywords = new ArrayList<>(List.of(
                "hợp lý", "mục tiêu", "ưu tiên", "cần trước", "để dành", "tiết kiệm", "kế hoạch"
        ));
        if (skillTag.contains("an toàn") || lesson.contains("an toàn") || question.contains("mật khẩu")) {
            keywords.addAll(List.of("an toàn", "không chia sẻ", "mật khẩu", "xác minh", "người lớn"));
        }
        if (skillTag.contains("ngân sách") || lesson.contains("ngân sách")) {
            keywords.addAll(List.of("giới hạn", "vừa đủ", "chia ra", "không vượt"));
        }
        if (skillTag.contains("nhận diện") || lesson.contains("tiền việt nam") || question.contains("mệnh giá")) {
            keywords.addAll(List.of("mệnh giá", "giá trị", "phân loại", "so sánh"));
        }
        if (skillTag.contains("đầu tư") || lesson.contains("đầu tư")) {
            keywords.addAll(List.of("tạo giá trị", "lâu dài", "mục tiêu lớn"));
        }
        Properties rubricProps = loadProperties(appliedRubricFile(form.getOrDefault("lessonId", ""), form.getOrDefault("questionId", "")));
        keywords.addAll(splitKeywords(rubricProps.getProperty("acceptedKeywords", "")));
        return keywords;
    }

    private static List<String> getNegativeKeywords() {
        return List.of("mua ngay", "thích", "đẹp", "cho vui", "tiêu hết", "vay", "kiếm tiền nhanh", "bốc đồng");
    }

    private static String cleanContent(String value) {
        return String.valueOf(value == null ? "" : value)
                .replace('\t', ' ')
                .replace('\n', ' ')
                .replace('\r', ' ')
                .trim();
    }

    private static VerificationDecision verifyCorrection(Map<String, String> form) throws IOException {
        String explanation = cleanContent(form.getOrDefault("studentExplanation", ""));
        String aiOriginalDecision = form.getOrDefault("aiOriginalDecision", "incorrect");
        if (explanation.length() < 8) {
            return new VerificationDecision("user_incorrect", "Lý do còn quá ngắn để kiểm chứng chắc chắn.", 0.9, false, false, false, "rule_engine");
        }

        List<String> positiveKeywords = getPositiveKeywords(form);
        List<String> negativeKeywords = getNegativeKeywords();
        boolean hasPositive = containsAny(explanation, positiveKeywords);
        boolean hasNegative = containsAny(explanation, negativeKeywords);
        boolean mentionsGoal = containsAny(explanation, List.of("mục tiêu", "tiết kiệm", "để dành", "ưu tiên"));
        int positiveScore = 0;
        for (String keyword : positiveKeywords) {
            if (explanation.toLowerCase(Locale.ROOT).contains(keyword)) positiveScore += 1;
        }

        if (hasNegative && !hasPositive) {
            return new VerificationDecision(
                    "user_incorrect",
                    "Lý do của bé đang nghiêng về chi tiêu cảm tính hoặc chưa bám mục tiêu bài học.",
                    0.9,
                    false,
                    false,
                    false,
                    "rule_engine"
            );
        }

        if ("incorrect".equalsIgnoreCase(aiOriginalDecision) && hasPositive && positiveScore >= 2) {
            return new VerificationDecision(
                    "user_correct",
                    "Lý do của bé thể hiện được mục tiêu tài chính hoặc cách ưu tiên hợp lý theo bài học.",
                    mentionsGoal ? 0.92 : 0.87,
                    true,
                    true,
                    true,
                    "rule_engine"
            );
        }

        if (hasPositive && hasNegative) {
            return new VerificationDecision(
                    "partially_correct",
                    "Lý do của bé có điểm hợp lý nhưng vẫn còn pha trộn với động cơ chưa thật sự phù hợp.",
                    0.72,
                    false,
                    false,
                    false,
                    "ai_verifier"
            );
        }

        if (hasPositive) {
            return new VerificationDecision(
                    "uncertain",
                    "Lý do của bé có vẻ hợp lý nhưng hệ thống chưa đủ chắc để tự cập nhật ngay.",
                    0.74,
                    false,
                    false,
                    true,
                    "ai_verifier"
            );
        }

        return new VerificationDecision(
                "user_incorrect",
                "Lý do hiện tại chưa cho thấy rõ sự phù hợp với mục tiêu bài học.",
                0.86,
                false,
                false,
                false,
                "rule_engine"
        );
    }

    private static String verificationJson(VerificationDecision decision) {
        return "{"
                + "\"result\":\"" + jsonEscape(decision.result) + "\","
                + "\"reason\":\"" + jsonEscape(decision.reason) + "\","
                + "\"confidenceScore\":" + decision.confidenceScore + ','
                + "\"verifiedBy\":\"" + jsonEscape(decision.verifiedBy) + "\","
                + "\"shouldUpdateAttempt\":" + decision.shouldUpdateAttempt + ','
                + "\"shouldCreateLearningMemory\":" + decision.shouldCreateLearningMemory + ','
                + "\"shouldSuggestRubricPatch\":" + decision.shouldSuggestRubricPatch
                + "}";
    }

    private static String loadFeedbackDetailJson(Properties feedback, Properties verification, Properties patch) {
        return "{"
                + "\"id\":\"" + jsonEscape(feedback.getProperty("id", "")) + "\","
                + "\"studentId\":\"" + jsonEscape(feedback.getProperty("studentId", "")) + "\","
                + "\"parentId\":\"" + jsonEscape(feedback.getProperty("parentId", "")) + "\","
                + "\"lessonId\":\"" + jsonEscape(feedback.getProperty("lessonId", "")) + "\","
                + "\"missionId\":\"" + jsonEscape(feedback.getProperty("missionId", "")) + "\","
                + "\"questionId\":\"" + jsonEscape(feedback.getProperty("questionId", "")) + "\","
                + "\"questionPrompt\":\"" + jsonEscape(feedback.getProperty("questionPrompt", "")) + "\","
                + "\"studentAnswer\":\"" + jsonEscape(feedback.getProperty("studentAnswer", "")) + "\","
                + "\"studentExplanation\":\"" + jsonEscape(feedback.getProperty("studentExplanation", "")) + "\","
                + "\"aiOriginalFeedback\":\"" + jsonEscape(feedback.getProperty("aiOriginalFeedback", "")) + "\","
                + "\"aiOriginalDecision\":\"" + jsonEscape(feedback.getProperty("aiOriginalDecision", "")) + "\","
                + "\"feedbackType\":\"" + jsonEscape(feedback.getProperty("feedbackType", "")) + "\","
                + "\"status\":\"" + jsonEscape(feedback.getProperty("status", "")) + "\","
                + "\"createdAt\":\"" + jsonEscape(feedback.getProperty("createdAt", "")) + "\","
                + "\"verificationResult\":\"" + jsonEscape(verification.getProperty("result", "")) + "\","
                + "\"verificationReason\":\"" + jsonEscape(verification.getProperty("reason", "")) + "\","
                + "\"confidenceScore\":" + verification.getProperty("confidenceScore", "0") + ','
                + "\"rubricPatch\":" + (patch.isEmpty() ? "null" : "{"
                + "\"id\":\"" + jsonEscape(patch.getProperty("id", "")) + "\","
                + "\"reason\":\"" + jsonEscape(patch.getProperty("reason", "")) + "\","
                + "\"status\":\"" + jsonEscape(patch.getProperty("status", "")) + "\""
                + "}")
                + "}";
    }

    private static List<Properties> listPropertyFiles(Path dir) throws IOException {
        List<Properties> items = new ArrayList<>();
        if (!Files.exists(dir)) return items;
        try (var stream = Files.list(dir)) {
            for (Path path : stream.filter(p -> p.getFileName().toString().endsWith(".properties")).toList()) {
                items.add(loadProperties(path));
            }
        }
        return items;
    }

    private static void writeCorrectionAudit(String action, String id, String detail) throws IOException {
        appendLog(correctionAuditFile(), Instant.now() + "|action=" + action + "|id=" + id + "|detail=" + cleanContent(detail));
    }

    private static String buildLearningMemoryJson(Properties props) {
        return "{"
                + "\"id\":\"" + jsonEscape(props.getProperty("id", "")) + "\","
                + "\"studentId\":\"" + jsonEscape(props.getProperty("studentId", "")) + "\","
                + "\"skillTag\":\"" + jsonEscape(props.getProperty("skillTag", "")) + "\","
                + "\"memoryType\":\"" + jsonEscape(props.getProperty("memoryType", "")) + "\","
                + "\"content\":\"" + jsonEscape(props.getProperty("content", "")) + "\","
                + "\"sourceFeedbackId\":\"" + jsonEscape(props.getProperty("sourceFeedbackId", "")) + "\","
                + "\"confidence\":" + props.getProperty("confidence", "0") + ','
                + "\"createdAt\":\"" + jsonEscape(props.getProperty("createdAt", "")) + "\""
                + "}";
    }

    private static Properties createLearningMemoryRecord(String studentId, String skillTag, String content, String sourceFeedbackId, double confidence) throws IOException {
        Properties props = new Properties();
        String id = newId("mem");
        props.setProperty("id", id);
        props.setProperty("studentId", studentId);
        props.setProperty("skillTag", skillTag);
        props.setProperty("memoryType", "verified_reasoning");
        props.setProperty("content", cleanContent(content));
        props.setProperty("sourceFeedbackId", sourceFeedbackId);
        props.setProperty("confidence", String.valueOf(confidence));
        props.setProperty("createdAt", Instant.now().toString());
        saveProperties(learningMemoryFile(id), props, "Finchi learning memory");
        return props;
    }

    private static Properties createRubricPatchRecord(Properties feedback, VerificationDecision decision) throws IOException {
        Properties patch = new Properties();
        String patchId = newId("patch");
        patch.setProperty("id", patchId);
        patch.setProperty("lessonId", feedback.getProperty("lessonId", ""));
        patch.setProperty("missionId", feedback.getProperty("missionId", ""));
        patch.setProperty("questionId", feedback.getProperty("questionId", ""));
        patch.setProperty("reason", "Nhiều phản hồi cho thấy cần mở rộng rubric cho lý do hợp lý của học sinh.");
        patch.setProperty("suggestedFromFeedbackId", feedback.getProperty("id", ""));
        patch.setProperty("status", "pending");
        patch.setProperty("acceptedKeywords", joinKeywords(tokenizeKeywords(feedback.getProperty("studentExplanation", ""))));
        patch.setProperty("createdAt", Instant.now().toString());
        patch.setProperty("confidenceScore", String.valueOf(decision.confidenceScore));
        saveProperties(rubricPatchFile(patchId), patch, "Finchi rubric patch");
        return patch;
    }

    private record VerificationDecision(
            String result,
            String reason,
            double confidenceScore,
            boolean shouldUpdateAttempt,
            boolean shouldCreateLearningMemory,
            boolean shouldSuggestRubricPatch,
            String verifiedBy
    ) {}

    private static void sendJson(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        Headers headers = exchange.getResponseHeaders();
        headers.set("Content-Type", "application/json; charset=utf-8");
        headers.set("Cache-Control", "no-store");
        headers.set("Access-Control-Allow-Origin", "*");
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private static String buildPlayerPayload(String username, Properties props) {
        String playerJson = props.getProperty("playerJson", "null");
        String parentName = props.getProperty("parentName", "");
        boolean parentLinked = !parentName.isBlank() && !props.getProperty("parentPasswordHash", "").isBlank();
        return "{"
                + "\"ok\":true,"
                + "\"username\":\"" + jsonEscape(username) + "\","
                + "\"nickname\":\"" + jsonEscape(props.getProperty("nickname", username)) + "\","
                + "\"avatarId\":\"" + jsonEscape(props.getProperty("avatarId", "ava-1")) + "\","
                + "\"parentName\":\"" + jsonEscape(parentName) + "\","
                + "\"parentLinked\":" + parentLinked + ','
                + "\"player\":" + (playerJson == null || playerJson.isBlank() ? "null" : playerJson)
                + "}";
    }

    private static final class HealthHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            sendJson(exchange, 200, "{\"status\":\"ok\",\"app\":\"FINCHI EDU\"}");
        }
    }

    private static final class SignupHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                return;
            }
            Map<String, String> form = parseForm(exchange);
            String username = form.getOrDefault("username", "").trim();
            String password = form.getOrDefault("password", "").trim();
            if (!isValidUsername(username)) {
                sendJson(exchange, 400, "{\"ok\":false,\"message\":\"Tên tài khoản chỉ gồm chữ, số, dấu gạch dưới và dài 3-24 ký tự.\"}");
                return;
            }
            if (password.length() < 4) {
                sendJson(exchange, 400, "{\"ok\":false,\"message\":\"Mật khẩu cần ít nhất 4 ký tự.\"}");
                return;
            }
            Path file = resolveAccountFile(username);
            if (Files.exists(file)) {
                sendJson(exchange, 409, "{\"ok\":false,\"message\":\"Tài khoản này đã tồn tại.\"}");
                return;
            }
            Properties props = new Properties();
            props.setProperty("passwordHash", sha256(password));
            props.setProperty("nickname", username);
            props.setProperty("avatarId", "ava-1");
            props.setProperty("dailyScore", "0");
            props.setProperty("weeklyScore", "0");
            props.setProperty("monthlyScore", "0");
            props.setProperty("tournamentWeekly", "0");
            props.setProperty("totalScore", "0");
            props.setProperty("completedLevelsCount", "0");
            props.setProperty("savingStreak", "0");
            props.setProperty("playerJson", "null");
            saveAccount(username, props);
            sendJson(exchange, 200, "{\"ok\":true,\"message\":\"Tạo tài khoản thành công.\"}");
        }
    }

    private static final class LoginHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                return;
            }
            Map<String, String> form = parseForm(exchange);
            String username = form.getOrDefault("username", "").trim();
            String password = form.getOrDefault("password", "").trim();
            if (!isSupportedUsername(username)) {
                sendJson(exchange, 400, "{\"ok\":false,\"message\":\"Tài khoản không hợp lệ hoặc không được hỗ trợ.\"}");
                return;
            }
            Properties props = loadAccount(username);
            if (props.isEmpty()) {
                sendJson(exchange, 404, "{\"ok\":false,\"message\":\"Không tìm thấy tài khoản.\"}");
                return;
            }
            if (!sha256(password).equals(props.getProperty("passwordHash", ""))) {
                sendJson(exchange, 401, "{\"ok\":false,\"message\":\"Sai mật khẩu.\"}");
                return;
            }
            sendJson(exchange, 200, buildPlayerPayload(username, props));
        }
    }

    private static final class ParentSignupHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                return;
            }
            Map<String, String> form = parseForm(exchange);
            String username = form.getOrDefault("username", "").trim();
            String parentName = form.getOrDefault("parentName", "").trim();
            String password = form.getOrDefault("password", "").trim();
            if (!isSupportedUsername(username)) {
                sendJson(exchange, 400, "{\"ok\":false,\"message\":\"Tên tài khoản học sinh không hợp lệ hoặc không được hỗ trợ.\"}");
                return;
            }
            if (parentName.length() < 2) {
                sendJson(exchange, 400, "{\"ok\":false,\"message\":\"Hãy nhập tên phụ huynh có ít nhất 2 ký tự.\"}");
                return;
            }
            if (password.length() < 4) {
                sendJson(exchange, 400, "{\"ok\":false,\"message\":\"Mật khẩu phụ huynh cần ít nhất 4 ký tự.\"}");
                return;
            }
            Properties props = loadAccount(username);
            if (props.isEmpty()) {
                sendJson(exchange, 404, "{\"ok\":false,\"message\":\"Không tìm thấy tài khoản học sinh để liên kết.\"}");
                return;
            }
            if (!props.getProperty("parentPasswordHash", "").isBlank()) {
                sendJson(exchange, 409, "{\"ok\":false,\"message\":\"Tài khoản phụ huynh đã tồn tại cho bé này.\"}");
                return;
            }
            props.setProperty("parentName", parentName);
            props.setProperty("parentPasswordHash", sha256(password));
            saveAccount(username, props);
            sendJson(exchange, 200, "{\"ok\":true,\"message\":\"Tạo tài khoản phụ huynh thành công.\"}");
        }
    }

    private static final class ParentLoginHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                return;
            }
            Map<String, String> form = parseForm(exchange);
            String username = form.getOrDefault("username", "").trim();
            String password = form.getOrDefault("password", "").trim();
            if (!isSupportedUsername(username)) {
                sendJson(exchange, 400, "{\"ok\":false,\"message\":\"Tên tài khoản học sinh không hợp lệ hoặc không được hỗ trợ.\"}");
                return;
            }
            Properties props = loadAccount(username);
            if (props.isEmpty()) {
                sendJson(exchange, 404, "{\"ok\":false,\"message\":\"Không tìm thấy tài khoản học sinh.\"}");
                return;
            }
            String parentHash = props.getProperty("parentPasswordHash", "");
            if (parentHash.isBlank()) {
                sendJson(exchange, 404, "{\"ok\":false,\"message\":\"Bé này chưa được tạo tài khoản phụ huynh.\"}");
                return;
            }
            if (!sha256(password).equals(parentHash)) {
                sendJson(exchange, 401, "{\"ok\":false,\"message\":\"Sai mật khẩu phụ huynh.\"}");
                return;
            }
            sendJson(exchange, 200, buildPlayerPayload(username, props));
        }
    }

    private static final class LoadPlayerHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                return;
            }
            String username = parseQuery(exchange.getRequestURI()).getOrDefault("username", "").trim();
            if (!isSupportedUsername(username)) {
                sendJson(exchange, 400, "{\"ok\":false,\"message\":\"Tài khoản không hợp lệ hoặc không được hỗ trợ.\"}");
                return;
            }
            Properties props = loadAccount(username);
            if (props.isEmpty()) {
                sendJson(exchange, 404, "{\"ok\":false,\"message\":\"Không tìm thấy tài khoản.\"}");
                return;
            }
            sendJson(exchange, 200, buildPlayerPayload(username, props));
        }
    }

    private static final class SavePlayerHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                return;
            }
            Map<String, String> form = parseForm(exchange);
            String username = form.getOrDefault("username", "").trim();
            if (!isSupportedUsername(username)) {
                sendJson(exchange, 400, "{\"ok\":false,\"message\":\"Tài khoản không hợp lệ hoặc không được hỗ trợ.\"}");
                return;
            }
            Properties props = loadAccount(username);
            if (props.isEmpty()) {
                sendJson(exchange, 404, "{\"ok\":false,\"message\":\"Không tìm thấy tài khoản để lưu.\"}");
                return;
            }
            props.setProperty("playerJson", form.getOrDefault("playerJson", "null"));
            props.setProperty("nickname", form.getOrDefault("nickname", username));
            props.setProperty("avatarId", form.getOrDefault("avatarId", "ava-1"));
            props.setProperty("dailyScore", form.getOrDefault("dailyScore", "0"));
            props.setProperty("weeklyScore", form.getOrDefault("weeklyScore", "0"));
            props.setProperty("monthlyScore", form.getOrDefault("monthlyScore", "0"));
            props.setProperty("tournamentWeekly", form.getOrDefault("tournamentWeekly", "0"));
            props.setProperty("totalScore", form.getOrDefault("totalScore", "0"));
            props.setProperty("completedLevelsCount", form.getOrDefault("completedLevelsCount", "0"));
            props.setProperty("savingStreak", form.getOrDefault("savingStreak", "0"));
            props.setProperty("clanId", form.getOrDefault("clanId", ""));
            props.setProperty("clanName", form.getOrDefault("clanName", ""));
            props.setProperty("clanFocus", form.getOrDefault("clanFocus", ""));
            props.setProperty("clanDescription", form.getOrDefault("clanDescription", ""));
            props.setProperty("todayStudySeconds", form.getOrDefault("todayStudySeconds", "0"));
            props.setProperty("todayQuestions", form.getOrDefault("todayQuestions", "0"));
            props.setProperty("todayCorrect", form.getOrDefault("todayCorrect", "0"));
            props.setProperty("weakSkill", form.getOrDefault("weakSkill", ""));
            props.setProperty("weakLevel", form.getOrDefault("weakLevel", ""));
            props.setProperty("childProgressStatus", form.getOrDefault("childProgressStatus", "on_track"));
            props.setProperty("aiVoiceEnabled", form.getOrDefault("aiVoiceEnabled", "false"));
            props.setProperty("aiCorrectStreak", form.getOrDefault("aiCorrectStreak", "0"));
            props.setProperty("aiInterventionCount", form.getOrDefault("aiInterventionCount", "0"));
            saveAccount(username, props);
            sendJson(exchange, 200, "{\"ok\":true}");
        }
    }

    private static final class LeaderboardHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                return;
            }
            String mode = parseQuery(exchange.getRequestURI()).getOrDefault("mode", "daily");
            List<Map<String, String>> entries = new ArrayList<>();
            if (Files.exists(ACCOUNTS_DIR)) {
                try (var stream = Files.list(ACCOUNTS_DIR)) {
                    stream.filter(path -> path.getFileName().toString().endsWith(".properties")).forEach(path -> {
                        try (InputStream input = Files.newInputStream(path)) {
                            Properties props = new Properties();
                            props.load(input);
                            Map<String, String> entry = new LinkedHashMap<>();
                            entry.put("name", props.getProperty("nickname", path.getFileName().toString().replace(".properties", "")));
                            entry.put("avatarId", props.getProperty("avatarId", "ava-1"));
                            String scoreKey = switch (mode) {
                                case "weekly" -> "weeklyScore";
                                case "monthly" -> "monthlyScore";
                                case "tournament" -> "tournamentWeekly";
                                default -> "dailyScore";
                            };
                            entry.put("score", props.getProperty(scoreKey, "0"));
                            entries.add(entry);
                        } catch (IOException ignored) {
                        }
                    });
                }
            }
            entries.sort(Comparator.comparingInt((Map<String, String> item) -> Integer.parseInt(item.getOrDefault("score", "0"))).reversed());
            StringBuilder builder = new StringBuilder();
            builder.append("{\"ok\":true,\"entries\":[");
            for (int i = 0; i < entries.size(); i++) {
                Map<String, String> entry = entries.get(i);
                if (i > 0) builder.append(',');
                builder.append('{')
                        .append("\"rank\":").append(i + 1).append(',')
                        .append("\"name\":\"").append(jsonEscape(entry.getOrDefault("name", "Người chơi"))).append("\",")
                        .append("\"avatarId\":\"").append(jsonEscape(entry.getOrDefault("avatarId", "ava-1"))).append("\",")
                        .append("\"score\":").append(Integer.parseInt(entry.getOrDefault("score", "0")))
                        .append('}');
            }
            builder.append("]}");
            sendJson(exchange, 200, builder.toString());
        }
    }

    private static final class ClanListHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                return;
            }
            Map<String, Map<String, String>> clans = new LinkedHashMap<>();
            Map<String, List<Map<String, String>>> membersByClan = new LinkedHashMap<>();
            if (Files.exists(ACCOUNTS_DIR)) {
                try (var stream = Files.list(ACCOUNTS_DIR)) {
                    stream.filter(path -> path.getFileName().toString().endsWith(".properties")).forEach(path -> {
                        try (InputStream input = Files.newInputStream(path)) {
                            Properties props = new Properties();
                            props.load(input);
                            String clanId = props.getProperty("clanId", "").trim();
                            if (clanId.isBlank()) return;
                            Map<String, String> clan = clans.computeIfAbsent(clanId, key -> {
                                Map<String, String> item = new LinkedHashMap<>();
                                item.put("id", clanId);
                                item.put("name", props.getProperty("clanName", clanId));
                                item.put("focus", props.getProperty("clanFocus", ""));
                                item.put("description", props.getProperty("clanDescription", ""));
                                return item;
                            });
                            if (clan.getOrDefault("name", "").isBlank()) clan.put("name", props.getProperty("clanName", clanId));
                            if (clan.getOrDefault("focus", "").isBlank()) clan.put("focus", props.getProperty("clanFocus", ""));
                            if (clan.getOrDefault("description", "").isBlank()) clan.put("description", props.getProperty("clanDescription", ""));

                            List<Map<String, String>> members = membersByClan.computeIfAbsent(clanId, key -> new ArrayList<>());
                            Map<String, String> member = new LinkedHashMap<>();
                            member.put("username", path.getFileName().toString().replace(".properties", ""));
                            member.put("name", props.getProperty("nickname", path.getFileName().toString().replace(".properties", "")));
                            member.put("avatarId", props.getProperty("avatarId", "ava-1"));
                            members.add(member);
                        } catch (IOException ignored) {
                        }
                    });
                }
            }

            List<Map<String, String>> orderedClans = new ArrayList<>(clans.values());
            orderedClans.sort((left, right) -> Integer.compare(
                    membersByClan.getOrDefault(right.get("id"), List.of()).size(),
                    membersByClan.getOrDefault(left.get("id"), List.of()).size()
            ));

            StringBuilder builder = new StringBuilder();
            builder.append("{\"ok\":true,\"clans\":[");
            for (int i = 0; i < orderedClans.size(); i++) {
                Map<String, String> clan = orderedClans.get(i);
                List<Map<String, String>> members = membersByClan.getOrDefault(clan.get("id"), List.of());
                if (i > 0) builder.append(',');
                builder.append('{')
                        .append("\"id\":\"").append(jsonEscape(clan.getOrDefault("id", ""))).append("\",")
                        .append("\"name\":\"").append(jsonEscape(clan.getOrDefault("name", "Clan Finchi"))).append("\",")
                        .append("\"focus\":\"").append(jsonEscape(clan.getOrDefault("focus", ""))).append("\",")
                        .append("\"description\":\"").append(jsonEscape(clan.getOrDefault("description", ""))).append("\",")
                        .append("\"memberCount\":").append(members.size()).append(',')
                        .append("\"members\":[");
                for (int memberIndex = 0; memberIndex < members.size(); memberIndex++) {
                    Map<String, String> member = members.get(memberIndex);
                    if (memberIndex > 0) builder.append(',');
                    builder.append('{')
                            .append("\"username\":\"").append(jsonEscape(member.getOrDefault("username", ""))).append("\",")
                            .append("\"name\":\"").append(jsonEscape(member.getOrDefault("name", "Người chơi"))).append("\",")
                            .append("\"avatarId\":\"").append(jsonEscape(member.getOrDefault("avatarId", "ava-1"))).append("\"")
                            .append('}');
                }
                builder.append("]}");
            }
            builder.append("]}");
            sendJson(exchange, 200, builder.toString());
        }
    }

    private static final class StudentEventHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                return;
            }
            Map<String, String> form = parseForm(exchange);
            String username = form.getOrDefault("username", "").trim();
            if (!isSupportedUsername(username)) {
                sendJson(exchange, 400, "{\"ok\":false,\"message\":\"Tài khoản học sinh không hợp lệ hoặc không được hỗ trợ.\"}");
                return;
            }
            Properties account = loadAccount(username);
            if (account.isEmpty()) {
                sendJson(exchange, 404, "{\"ok\":false,\"message\":\"Không tìm thấy tài khoản học sinh.\"}");
                return;
            }
            Properties stateProps = loadProperties(studentStateFile(username));
            updateAiState(stateProps, form);
            saveProperties(studentStateFile(username), stateProps, "Finchi student learning state");
            appendLog(
                    studentEventFile(username),
                    Instant.now() + "|event=" + form.getOrDefault("eventType", "")
                            + "|lesson=" + form.getOrDefault("currentLesson", "")
                            + "|mission=" + form.getOrDefault("currentMission", "")
                            + "|skill=" + form.getOrDefault("skillTag", "")
                            + "|correct=" + form.getOrDefault("isCorrect", "false")
                            + "|attempt=" + form.getOrDefault("attemptCount", "0")
            );
            sendJson(
                    exchange,
                    200,
                    "{"
                            + "\"ok\":true,"
                            + "\"supportStatus\":\"" + jsonEscape(stateProps.getProperty("childProgressStatus", "on_track")) + "\","
                            + "\"weakSkill\":\"" + jsonEscape(stateProps.getProperty("weakSkill", "")) + "\","
                            + "\"weakLevel\":\"" + jsonEscape(stateProps.getProperty("weakLevel", "")) + "\""
                            + "}"
            );
        }
    }

    private static final class ParentEventHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                return;
            }
            Map<String, String> form = parseForm(exchange);
            String username = form.getOrDefault("username", "").trim();
            if (!isSupportedUsername(username)) {
                sendJson(exchange, 400, "{\"ok\":false,\"message\":\"Tài khoản học sinh không hợp lệ hoặc không được hỗ trợ.\"}");
                return;
            }
            Properties account = loadAccount(username);
            if (account.isEmpty()) {
                sendJson(exchange, 404, "{\"ok\":false,\"message\":\"Không tìm thấy tài khoản học sinh.\"}");
                return;
            }
            Properties stateProps = loadProperties(studentStateFile(username));
            updateAiState(stateProps, form);
            saveProperties(studentStateFile(username), stateProps, "Finchi student learning state");
            appendLog(
                    parentEventFile(username),
                    Instant.now() + "|event=" + form.getOrDefault("eventType", "")
                            + "|page=" + form.getOrDefault("currentPage", "")
                            + "|weakSkill=" + form.getOrDefault("weakSkill", "")
                            + "|weakLevel=" + form.getOrDefault("weakLevel", "")
            );
            sendJson(exchange, 200, "{\"ok\":true}");
        }
    }

    private static final class AiInterventionHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                return;
            }
            Map<String, String> form = parseForm(exchange);
            String username = form.getOrDefault("username", "").trim();
            if (!isSupportedUsername(username)) {
                sendJson(exchange, 400, "{\"ok\":false,\"message\":\"Tài khoản học sinh không hợp lệ hoặc không được hỗ trợ.\"}");
                return;
            }
            String role = form.getOrDefault("role", "student").trim();
            String triggerEvent = form.getOrDefault("triggerEvent", form.getOrDefault("eventType", "")).trim();
            String title;
            String message;
            String characterState;
            boolean shouldSpeak;
            String voiceType;
            String nextAction;
            String extraSummary = "";

            if ("parent".equals(role)) {
                Properties stateProps = loadProperties(studentStateFile(username));
                updateAiState(stateProps, form);
                saveProperties(studentStateFile(username), stateProps, "Finchi student learning state");
                if ("parent_viewed_mistake_detail".equals(triggerEvent)) {
                    String weakSkill = stateProps.getProperty("weakSkill", form.getOrDefault("weakSkill", "")).trim();
                    title = "FINCHI giải thích lỗi thường gặp";
                    message = weakSkill.isBlank()
                            ? "Con chưa có lỗi lặp lại rõ rệt. Phụ huynh có thể tiếp tục giữ nhịp học đều để FINCHI quan sát thêm."
                            : "Con đang hay nhầm ở kỹ năng " + weakSkill.toLowerCase(Locale.ROOT)
                            + ". Hãy cho con giải thích bằng lời trước khi chọn đáp án để con luyện tư duy rõ hơn.";
                } else {
                    title = "FINCHI tóm tắt cho phụ huynh";
                    message = buildParentSummaryMessage(stateProps);
                    extraSummary = ",\"summary\":" + buildParentSummaryJson(stateProps);
                }
                characterState = "parent_summary";
                shouldSpeak = false;
                voiceType = "parent-summary";
                nextAction = "review_dashboard";
            } else {
                int attemptCount = parseInt(form.getOrDefault("attemptCount", "0"), 0);
                int correctStreak = parseInt(form.getOrDefault("correctStreak", "0"), 0);
                int mistakeCountSkill = parseInt(form.getOrDefault("mistakeCountSkill", "0"), 0);
                String skillTag = form.getOrDefault("skillTag", "bài học hiện tại").trim();
                String currentLesson = form.getOrDefault("currentLesson", "bài học hiện tại").trim();
                switch (triggerEvent) {
                    case "student_requested_hint" -> {
                        title = "Gợi ý của FINCHI";
                        message = "Con hãy đọc lại mục tiêu của câu này nhé. Hãy chọn đáp án nào gần với kỹ năng "
                                + skillTag.toLowerCase(Locale.ROOT) + " nhất.";
                        characterState = "hint";
                        shouldSpeak = true;
                        voiceType = "short-hint";
                        nextAction = "retry";
                    }
                    case "student_idle_too_long" -> {
                        title = "FINCHI nhắc nhẹ";
                        message = "Con đang phân vân đúng không? Nếu cần, hãy nhìn lại món nào cần dùng trước rồi chọn nhé.";
                        characterState = "thinking";
                        shouldSpeak = true;
                        voiceType = "idle-nudge";
                        nextAction = "offer_hint";
                    }
                    case "student_repeated_mistake" -> {
                        title = "FINCHI đang hỗ trợ";
                        message = "Con đang nhầm lặp lại ở kỹ năng " + skillTag.toLowerCase(Locale.ROOT)
                                + ". Mình thử chậm lại một chút và so sánh từng lựa chọn với mục tiêu bài học nhé.";
                        characterState = "encourage";
                        shouldSpeak = true;
                        voiceType = "guided-support";
                        nextAction = "practice_easier";
                    }
                    case "student_answer_correct" -> {
                        title = "FINCHI chúc mừng";
                        message = correctStreak >= 3
                                ? "Con đang làm rất tốt. Ba câu đúng liên tiếp rồi, mình tiếp tục giữ nhịp nhé!"
                                : "Con đã chọn đúng rồi. Mình tiếp tục câu tiếp theo nhé!";
                        characterState = "celebrate";
                        shouldSpeak = correctStreak >= 3;
                        voiceType = "celebrate";
                        nextAction = "next_challenge";
                    }
                    case "student_completed_mission" -> {
                        title = "FINCHI tổng kết level";
                        message = "Con vừa hoàn thành một chặng học về " + currentLesson.toLowerCase(Locale.ROOT)
                                + ". Hãy nhớ điều quan trọng nhất và mang nó sang level tiếp theo nhé.";
                        characterState = "celebrate";
                        shouldSpeak = true;
                        voiceType = "mission-complete";
                        nextAction = "continue";
                    }
                    default -> {
                        title = "FINCHI giải thích nhẹ";
                        if (mistakeCountSkill >= 3 || attemptCount >= 2) {
                            message = "Con thử nghĩ lại nhé. Hãy bỏ qua lựa chọn hấp dẫn nhất trước mắt và xem lựa chọn nào phù hợp mục tiêu hơn.";
                            characterState = "hint";
                            voiceType = "guided-support";
                        } else {
                            message = "Không sao đâu. Con thử đọc kỹ tình huống thêm một lần và nghĩ xem món nào thật sự cần trước nhé.";
                            characterState = "wrong_soft";
                            voiceType = "soft-correction";
                        }
                        shouldSpeak = true;
                        nextAction = "retry";
                    }
                }
            }

            String safeMessage = safeAiMessage(message);
            appendLog(
                    interventionFile(username),
                    Instant.now() + "|role=" + role + "|trigger=" + triggerEvent
                            + "|characterState=" + characterState + "|message=" + safeMessage
            );

            sendJson(
                    exchange,
                    200,
                    "{"
                            + "\"ok\":true,"
                            + "\"title\":\"" + jsonEscape(title) + "\","
                            + "\"message\":\"" + jsonEscape(safeMessage) + "\","
                            + "\"characterState\":\"" + jsonEscape(characterState) + "\","
                            + "\"shouldSpeak\":" + shouldSpeak + ','
                            + "\"voiceType\":\"" + jsonEscape(voiceType) + "\","
                            + "\"nextAction\":\"" + jsonEscape(nextAction) + "\","
                            + "\"safetyStatus\":\"safe\""
                            + extraSummary
                            + "}"
            );
        }
    }

    private static final class VerifyAnswerHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                return;
            }
            Map<String, String> form = parseForm(exchange);
            VerificationDecision decision = verifyCorrection(form);
            sendJson(exchange, 200, "{\"ok\":true,\"verification\":" + verificationJson(decision) + "}");
        }
    }

    private static final class CorrectionFeedbackHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                return;
            }
            Map<String, String> form = parseForm(exchange);
            String username = form.getOrDefault("username", "").trim();
            if (!isSupportedUsername(username)) {
                sendJson(exchange, 400, "{\"ok\":false,\"message\":\"Tài khoản học sinh không hợp lệ hoặc không được hỗ trợ.\"}");
                return;
            }
            Properties account = loadAccount(username);
            if (account.isEmpty()) {
                sendJson(exchange, 404, "{\"ok\":false,\"message\":\"Không tìm thấy tài khoản học sinh.\"}");
                return;
            }

            Properties feedback = new Properties();
            String feedbackId = newId("fb");
            feedback.setProperty("id", feedbackId);
            feedback.setProperty("studentId", username);
            feedback.setProperty("parentId", form.getOrDefault("parentId", ""));
            feedback.setProperty("lessonId", form.getOrDefault("lessonId", ""));
            feedback.setProperty("missionId", form.getOrDefault("missionId", ""));
            feedback.setProperty("questionId", form.getOrDefault("questionId", ""));
            feedback.setProperty("questionPrompt", form.getOrDefault("questionPrompt", ""));
            feedback.setProperty("studentAnswer", form.getOrDefault("studentAnswer", ""));
            feedback.setProperty("studentExplanation", cleanContent(form.getOrDefault("studentExplanation", "")));
            feedback.setProperty("aiOriginalFeedback", form.getOrDefault("aiOriginalFeedback", ""));
            feedback.setProperty("aiOriginalDecision", form.getOrDefault("aiOriginalDecision", "incorrect"));
            feedback.setProperty("feedbackType", form.getOrDefault("feedbackType", "child_disagrees"));
            feedback.setProperty("status", "pending_review");
            feedback.setProperty("currentLesson", form.getOrDefault("currentLesson", ""));
            feedback.setProperty("skillTag", form.getOrDefault("skillTag", ""));
            feedback.setProperty("createdAt", Instant.now().toString());
            feedback.setProperty("updatedAt", Instant.now().toString());
            saveProperties(correctionFeedbackFile(feedbackId), feedback, "Finchi correction feedback");

            VerificationDecision decision = verifyCorrection(form);
            Properties verification = new Properties();
            verification.setProperty("feedbackId", feedbackId);
            verification.setProperty("result", decision.result);
            verification.setProperty("reason", decision.reason);
            verification.setProperty("verifiedBy", decision.verifiedBy);
            verification.setProperty("confidenceScore", String.valueOf(decision.confidenceScore));
            verification.setProperty("shouldUpdateAttempt", String.valueOf(decision.shouldUpdateAttempt));
            verification.setProperty("shouldCreateLearningMemory", String.valueOf(decision.shouldCreateLearningMemory));
            verification.setProperty("shouldSuggestRubricPatch", String.valueOf(decision.shouldSuggestRubricPatch));
            verification.setProperty("createdAt", Instant.now().toString());
            saveProperties(verificationResultFile(feedbackId), verification, "Finchi verification result");

            String responseTitle = "FINCHI đang kiểm chứng lại";
            String responseMessage = "Cảm ơn con đã giải thích. FINCHI sẽ xem lại lựa chọn này nhé.";
            String characterState = "parent_summary";
            boolean shouldSpeak = false;
            Properties learningMemory = new Properties();
            Properties patch = new Properties();

            if ("user_correct".equals(decision.result) && decision.confidenceScore >= 0.85) {
                feedback.setProperty("status", "auto_verified_correct");
                learningMemory = createLearningMemoryRecord(
                        username,
                        form.getOrDefault("skillTag", ""),
                        form.getOrDefault("studentExplanation", ""),
                        feedbackId,
                        decision.confidenceScore
                );
                if (decision.shouldSuggestRubricPatch) {
                    patch = createRubricPatchRecord(feedback, decision);
                    feedback.setProperty("rubricPatchId", patch.getProperty("id", ""));
                }
                feedback.setProperty("learningMemoryId", learningMemory.getProperty("id", ""));
                responseTitle = "FINCHI đã hiểu lại";
                responseMessage = "Con nói có lý. FINCHI hiểu chưa đủ ý của con. FINCHI sẽ ghi nhớ cách giải thích này cho lần sau.";
                characterState = "celebrate";
                shouldSpeak = true;
            } else if ("user_incorrect".equals(decision.result) && decision.confidenceScore >= 0.85) {
                feedback.setProperty("status", "auto_verified_incorrect");
                responseTitle = "FINCHI giải thích lại nhẹ hơn";
                responseMessage = "FINCHI hiểu ý con rồi. Nhưng trong tình huống này, mục tiêu là chọn món cần dùng trước. Mình cùng thử lại với một ví dụ dễ hơn nhé.";
                characterState = "wrong_soft";
                shouldSpeak = true;
            } else {
                feedback.setProperty("status", "needs_human_review");
                if (decision.shouldSuggestRubricPatch) {
                    patch = createRubricPatchRecord(feedback, decision);
                    feedback.setProperty("rubricPatchId", patch.getProperty("id", ""));
                }
                responseTitle = "FINCHI cần xem kỹ hơn";
                responseMessage = "Lựa chọn của con có điểm hợp lý. FINCHI sẽ nhờ hàng chờ duyệt xem lại để ghi nhận chính xác hơn.";
                characterState = "parent_summary";
            }

            feedback.setProperty("updatedAt", Instant.now().toString());
            saveProperties(correctionFeedbackFile(feedbackId), feedback, "Finchi correction feedback");
            writeCorrectionAudit("correction_feedback_submitted", feedbackId, feedback.getProperty("status", ""));

            sendJson(
                    exchange,
                    200,
                    "{"
                            + "\"ok\":true,"
                            + "\"feedbackId\":\"" + jsonEscape(feedbackId) + "\","
                            + "\"status\":\"" + jsonEscape(feedback.getProperty("status", "")) + "\","
                            + "\"verification\":" + verificationJson(decision) + ','
                            + "\"responseTitle\":\"" + jsonEscape(responseTitle) + "\","
                            + "\"responseMessage\":\"" + jsonEscape(safeAiMessage(responseMessage)) + "\","
                            + "\"characterState\":\"" + jsonEscape(characterState) + "\","
                            + "\"shouldSpeak\":" + shouldSpeak + ','
                            + "\"learningMemoryEntry\":" + (learningMemory.isEmpty() ? "null" : buildLearningMemoryJson(learningMemory))
                            + "}"
            );
        }
    }

    private static final class AdminCorrectionFeedbackHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String method = exchange.getRequestMethod();
            String path = exchange.getRequestURI().getPath();
            String base = "/api/admin/correction-feedback";
            if ("GET".equalsIgnoreCase(method) && base.equals(path)) {
                List<Properties> feedbacks = listPropertyFiles(CORRECTION_FEEDBACK_DIR);
                feedbacks.sort(Comparator.comparing((Properties props) -> props.getProperty("createdAt", "")).reversed());
                StringBuilder builder = new StringBuilder();
                builder.append("{\"ok\":true,\"items\":[");
                for (int i = 0; i < feedbacks.size(); i++) {
                    Properties feedback = feedbacks.get(i);
                    Properties verification = loadProperties(verificationResultFile(feedback.getProperty("id", "")));
                    if (i > 0) builder.append(',');
                    builder.append('{')
                            .append("\"id\":\"").append(jsonEscape(feedback.getProperty("id", ""))).append("\",")
                            .append("\"studentId\":\"").append(jsonEscape(feedback.getProperty("studentId", ""))).append("\",")
                            .append("\"questionPrompt\":\"").append(jsonEscape(feedback.getProperty("questionPrompt", ""))).append("\",")
                            .append("\"status\":\"").append(jsonEscape(feedback.getProperty("status", ""))).append("\",")
                            .append("\"verificationResult\":\"").append(jsonEscape(verification.getProperty("result", ""))).append("\",")
                            .append("\"createdAt\":\"").append(jsonEscape(feedback.getProperty("createdAt", ""))).append("\"")
                            .append('}');
                }
                builder.append("]}");
                sendJson(exchange, 200, builder.toString());
                return;
            }

            if (path.startsWith(base + "/") && "GET".equalsIgnoreCase(method)) {
                String id = path.substring((base + "/").length()).trim();
                Properties feedback = loadProperties(correctionFeedbackFile(id));
                if (feedback.isEmpty()) {
                    sendJson(exchange, 404, "{\"ok\":false,\"message\":\"Không tìm thấy feedback này.\"}");
                    return;
                }
                Properties verification = loadProperties(verificationResultFile(id));
                String rubricPatchId = feedback.getProperty("rubricPatchId", "");
                Properties patch = rubricPatchId.isBlank() ? new Properties() : loadProperties(rubricPatchFile(rubricPatchId));
                sendJson(exchange, 200, "{\"ok\":true,\"item\":" + loadFeedbackDetailJson(feedback, verification, patch) + "}");
                return;
            }

            if (path.startsWith(base + "/") && "POST".equalsIgnoreCase(method)) {
                String tail = path.substring((base + "/").length()).trim();
                String[] parts = tail.split("/");
                if (parts.length != 2) {
                    exchange.sendResponseHeaders(404, -1);
                    return;
                }
                String id = parts[0];
                String action = parts[1];
                Properties feedback = loadProperties(correctionFeedbackFile(id));
                if (feedback.isEmpty()) {
                    sendJson(exchange, 404, "{\"ok\":false,\"message\":\"Không tìm thấy feedback này.\"}");
                    return;
                }
                Properties verification = loadProperties(verificationResultFile(id));
                if ("approve".equalsIgnoreCase(action)) {
                    feedback.setProperty("status", "approved_as_correct");
                    if (verification.getProperty("result", "").isBlank() || "uncertain".equals(verification.getProperty("result", ""))) {
                        verification.setProperty("result", "user_correct");
                        verification.setProperty("reason", "Admin đã duyệt rằng lý do của học sinh là hợp lý.");
                        verification.setProperty("confidenceScore", "0.9");
                    }
                    if (feedback.getProperty("learningMemoryId", "").isBlank()) {
                        Properties memory = createLearningMemoryRecord(
                                feedback.getProperty("studentId", ""),
                                feedback.getProperty("skillTag", ""),
                                feedback.getProperty("studentExplanation", ""),
                                id,
                                Double.parseDouble(verification.getProperty("confidenceScore", "0.9"))
                        );
                        feedback.setProperty("learningMemoryId", memory.getProperty("id", ""));
                    }
                    saveProperties(verificationResultFile(id), verification, "Finchi verification result");
                    writeCorrectionAudit("correction_feedback_approved", id, feedback.getProperty("studentId", ""));
                } else if ("reject".equalsIgnoreCase(action)) {
                    feedback.setProperty("status", "rejected");
                    writeCorrectionAudit("correction_feedback_rejected", id, feedback.getProperty("studentId", ""));
                } else {
                    exchange.sendResponseHeaders(404, -1);
                    return;
                }
                feedback.setProperty("updatedAt", Instant.now().toString());
                saveProperties(correctionFeedbackFile(id), feedback, "Finchi correction feedback");
                sendJson(exchange, 200, "{\"ok\":true}");
                return;
            }

            exchange.sendResponseHeaders(404, -1);
        }
    }

    private static final class AdminRubricPatchHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                return;
            }
            String path = exchange.getRequestURI().getPath();
            String base = "/api/admin/rubric-patches/";
            if (!path.startsWith(base) || !path.endsWith("/apply")) {
                exchange.sendResponseHeaders(404, -1);
                return;
            }
            String patchId = path.substring(base.length(), path.length() - "/apply".length()).trim();
            Properties patch = loadProperties(rubricPatchFile(patchId));
            if (patch.isEmpty()) {
                sendJson(exchange, 404, "{\"ok\":false,\"message\":\"Không tìm thấy rubric patch.\"}");
                return;
            }
            Properties applied = loadProperties(appliedRubricFile(patch.getProperty("lessonId", ""), patch.getProperty("questionId", "")));
            List<String> mergedKeywords = splitKeywords(applied.getProperty("acceptedKeywords", ""));
            for (String token : splitKeywords(patch.getProperty("acceptedKeywords", ""))) {
                if (!token.isBlank() && token.length() > 2 && !mergedKeywords.contains(token)) mergedKeywords.add(token);
            }
            applied.setProperty("acceptedKeywords", joinKeywords(mergedKeywords));
            applied.setProperty("updatedAt", Instant.now().toString());
            saveProperties(appliedRubricFile(patch.getProperty("lessonId", ""), patch.getProperty("questionId", "")), applied, "Finchi applied rubric");
            patch.setProperty("status", "applied");
            patch.setProperty("appliedAt", Instant.now().toString());
            saveProperties(rubricPatchFile(patchId), patch, "Finchi rubric patch");
            String feedbackId = patch.getProperty("suggestedFromFeedbackId", "");
            if (!feedbackId.isBlank()) {
                Properties feedback = loadProperties(correctionFeedbackFile(feedbackId));
                if (!feedback.isEmpty()) {
                    feedback.setProperty("status", "rubric_updated");
                    feedback.setProperty("updatedAt", Instant.now().toString());
                    saveProperties(correctionFeedbackFile(feedbackId), feedback, "Finchi correction feedback");
                }
            }
            writeCorrectionAudit("rubric_patch_applied", patchId, patch.getProperty("questionId", ""));
            sendJson(exchange, 200, "{\"ok\":true}");
        }
    }

    private static final class AdminImportAccountHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                return;
            }
            String expectedToken = System.getenv("ACCOUNT_IMPORT_TOKEN");
            if (expectedToken == null || expectedToken.isBlank()) {
                sendJson(exchange, 503, "{\"ok\":false,\"message\":\"Chưa cấu hình ACCOUNT_IMPORT_TOKEN trên server.\"}");
                return;
            }

            Map<String, String> form = parseForm(exchange);
            String token = form.getOrDefault("token", "");
            if (!expectedToken.equals(token)) {
                sendJson(exchange, 403, "{\"ok\":false,\"message\":\"Sai token import account.\"}");
                return;
            }

            String username = form.getOrDefault("username", "").trim();
            if (!isSupportedUsername(username)) {
                sendJson(exchange, 400, "{\"ok\":false,\"message\":\"Tên tài khoản import không hợp lệ hoặc không được hỗ trợ.\"}");
                return;
            }

            String content = form.getOrDefault("content", "");
            if (content.isBlank()) {
                sendJson(exchange, 400, "{\"ok\":false,\"message\":\"Thiếu nội dung account để import.\"}");
                return;
            }

            boolean overwrite = parseBoolean(form.getOrDefault("overwrite", "false"));
            Path destination = accountFile(username);
            if (Files.exists(destination) && !overwrite) {
                sendJson(
                        exchange,
                        200,
                        "{"
                                + "\"ok\":true,"
                                + "\"status\":\"skipped\","
                                + "\"username\":\"" + jsonEscape(username) + "\""
                                + "}"
                );
                return;
            }

            Files.writeString(
                    destination,
                    content,
                    StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE,
                    StandardOpenOption.TRUNCATE_EXISTING,
                    StandardOpenOption.WRITE
            );
            sendJson(
                    exchange,
                    200,
                    "{"
                            + "\"ok\":true,"
                            + "\"status\":\"" + (overwrite ? "overwritten" : "imported") + "\","
                            + "\"username\":\"" + jsonEscape(username) + "\""
                            + "}"
            );
        }
    }

    private static final class VoicePolicyHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                return;
            }
            Map<String, String> form = parseForm(exchange);
            sendJson(
                    exchange,
                    200,
                    "{"
                            + "\"ok\":true,"
                            + "\"engine\":\"browser-speech-synthesis\","
                            + "\"message\":\"" + jsonEscape(safeAiMessage(form.getOrDefault("message", ""))) + "\","
                            + "\"shouldSpeak\":" + parseBoolean(form.getOrDefault("shouldSpeak", "false"))
                            + "}"
            );
        }
    }

    private static final class StudentLearningStateHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                return;
            }
            String path = exchange.getRequestURI().getPath();
            String prefix = "/api/student/";
            if (!path.startsWith(prefix)) {
                exchange.sendResponseHeaders(404, -1);
                return;
            }
            boolean requestState = path.endsWith("/learning-state");
            boolean requestMemory = path.endsWith("/learning-memory");
            if (!requestState && !requestMemory) {
                exchange.sendResponseHeaders(404, -1);
                return;
            }
            String suffix = requestState ? "/learning-state" : "/learning-memory";
            String username = path.substring(prefix.length(), path.length() - suffix.length()).trim();
            if (!isSupportedUsername(username)) {
                sendJson(exchange, 400, "{\"ok\":false,\"message\":\"Tài khoản học sinh không hợp lệ hoặc không được hỗ trợ.\"}");
                return;
            }
            if (requestMemory) {
                List<Properties> memories = listPropertyFiles(LEARNING_MEMORY_DIR);
                memories.removeIf(props -> !username.equalsIgnoreCase(props.getProperty("studentId", "")));
                memories.sort(Comparator.comparing((Properties props) -> props.getProperty("createdAt", "")).reversed());
                StringBuilder builder = new StringBuilder();
                builder.append("{\"ok\":true,\"studentId\":\"")
                        .append(jsonEscape(username))
                        .append("\",\"items\":[");
                for (int i = 0; i < memories.size(); i++) {
                    if (i > 0) builder.append(',');
                    builder.append(buildLearningMemoryJson(memories.get(i)));
                }
                builder.append("]}");
                sendJson(exchange, 200, builder.toString());
                return;
            }

            Properties props = loadProperties(studentStateFile(username));
            sendJson(
                    exchange,
                    200,
                    "{"
                            + "\"ok\":true,"
                            + "\"studentId\":\"" + jsonEscape(username) + "\","
                            + "\"currentLesson\":\"" + jsonEscape(props.getProperty("currentLesson", "")) + "\","
                            + "\"currentMission\":\"" + jsonEscape(props.getProperty("currentMission", "")) + "\","
                            + "\"currentLevelId\":" + parseInt(props.getProperty("currentLevelId", "0"), 0) + ','
                            + "\"correctStreak\":" + parseInt(props.getProperty("correctStreak", "0"), 0) + ','
                            + "\"mistakeCountSkill\":" + parseInt(props.getProperty("mistakeCountSkill", "0"), 0) + ','
                            + "\"weakSkill\":\"" + jsonEscape(props.getProperty("weakSkill", "")) + "\","
                            + "\"weakLevel\":\"" + jsonEscape(props.getProperty("weakLevel", "")) + "\","
                            + "\"supportStatus\":\"" + jsonEscape(props.getProperty("childProgressStatus", "on_track")) + "\","
                            + "\"lastEventType\":\"" + jsonEscape(props.getProperty("lastEventType", "")) + "\","
                            + "\"lastUpdatedAt\":\"" + jsonEscape(props.getProperty("lastUpdatedAt", "")) + "\""
                            + "}"
            );
        }
    }

    private static final class ParentContextSummaryHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                return;
            }
            String path = exchange.getRequestURI().getPath();
            String prefix = "/api/parent/";
            String suffix = "/context-summary";
            if (!path.startsWith(prefix) || !path.endsWith(suffix)) {
                exchange.sendResponseHeaders(404, -1);
                return;
            }
            String username = path.substring(prefix.length(), path.length() - suffix.length()).trim();
            if (!isSupportedUsername(username)) {
                sendJson(exchange, 400, "{\"ok\":false,\"message\":\"Tài khoản học sinh không hợp lệ hoặc không được hỗ trợ.\"}");
                return;
            }
            Properties account = loadAccount(username);
            if (account.isEmpty()) {
                sendJson(exchange, 404, "{\"ok\":false,\"message\":\"Không tìm thấy tài khoản học sinh.\"}");
                return;
            }
            Properties props = loadProperties(studentStateFile(username));
            if (props.getProperty("playerName", "").isBlank()) {
                props.setProperty("playerName", account.getProperty("nickname", username));
            }
            if (props.getProperty("parentName", "").isBlank()) {
                props.setProperty("parentName", account.getProperty("parentName", ""));
            }
            String summaryJson = buildParentSummaryJson(props);
            sendJson(
                    exchange,
                    200,
                    "{"
                            + "\"ok\":true,"
                            + "\"childId\":\"" + jsonEscape(username) + "\","
                            + "\"message\":\"" + jsonEscape(buildParentSummaryMessage(props)) + "\","
                            + "\"summary\":" + summaryJson + ','
                            + "\"lastEventType\":\"" + jsonEscape(props.getProperty("lastEventType", "")) + "\","
                            + "\"lastUpdatedAt\":\"" + jsonEscape(props.getProperty("lastUpdatedAt", "")) + "\""
                            + "}"
            );
        }
    }

    private static final class StaticFileHandler implements HttpHandler {
        private static final Map<String, String> CONTENT_TYPES = new HashMap<>();

        static {
            CONTENT_TYPES.put(".html", "text/html; charset=utf-8");
            CONTENT_TYPES.put(".css", "text/css; charset=utf-8");
            CONTENT_TYPES.put(".js", "application/javascript; charset=utf-8");
            CONTENT_TYPES.put(".json", "application/json; charset=utf-8");
            CONTENT_TYPES.put(".svg", "image/svg+xml");
            CONTENT_TYPES.put(".png", "image/png");
            CONTENT_TYPES.put(".jpg", "image/jpeg");
            CONTENT_TYPES.put(".jpeg", "image/jpeg");
            CONTENT_TYPES.put(".webp", "image/webp");
            CONTENT_TYPES.put(".avif", "image/avif");
            CONTENT_TYPES.put(".mp4", "video/mp4");
            CONTENT_TYPES.put(".mp3", "audio/mpeg");
            CONTENT_TYPES.put(".ico", "image/x-icon");
        }

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                return;
            }

            URI uri = exchange.getRequestURI();
            String path = uri.getPath();
            if (path == null || path.equals("/")) {
                path = "/index.html";
            }

            if (path.contains("..")) {
                exchange.sendResponseHeaders(400, -1);
                return;
            }

            String resourcePath = "/static" + path;
            try (InputStream inputStream = FinchiApplication.class.getResourceAsStream(resourcePath)) {
                if (inputStream == null) {
                    byte[] notFound = "404 - Không tìm thấy tài nguyên".getBytes(StandardCharsets.UTF_8);
                    exchange.getResponseHeaders().set("Content-Type", "text/plain; charset=utf-8");
                    exchange.sendResponseHeaders(404, notFound.length);
                    try (OutputStream os = exchange.getResponseBody()) {
                        os.write(notFound);
                    }
                    return;
                }

                byte[] bytes = inputStream.readAllBytes();
                exchange.getResponseHeaders().set("Content-Type", resolveContentType(path));
                if (path.endsWith(".mp4") || path.endsWith(".mp3")) {
                    exchange.getResponseHeaders().set("Accept-Ranges", "bytes");
                }
                exchange.sendResponseHeaders(200, bytes.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(bytes);
                }
            }
        }

        private String resolveContentType(String path) {
            return CONTENT_TYPES.entrySet().stream()
                    .filter(entry -> path.endsWith(entry.getKey()))
                    .map(Map.Entry::getValue)
                    .findFirst()
                    .orElse("application/octet-stream");
        }
    }
}
