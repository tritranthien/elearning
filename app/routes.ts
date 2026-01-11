import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
    layout("routes/layout.tsx", [
        index("routes/home.tsx"),
        route("topics", "routes/topics.tsx"),
        route("topics/new", "routes/topic-new.tsx"),
        route("dictionary", "routes/dictionary.tsx"),
        route("dictionary/quiz", "routes/dictionary-quiz.tsx"),
        route("practice", "routes/practice.tsx"),
    ]),
    route("learn/:topicId", "routes/learn.tsx"), // Standalone route without layout for immersive mode
    route("quiz/:topicId", "routes/quiz.tsx"), // Quiz route for topic
    route("login", "routes/auth/login.tsx"),
    route("register", "routes/auth/register.tsx"),
    route("logout", "routes/auth/logout.tsx"),
] satisfies RouteConfig;
