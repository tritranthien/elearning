import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
    layout("routes/layout.tsx", [
        index("routes/home.tsx"),
        route("topics", "routes/topics.tsx"),
    ]),
    route("learn/:topicId", "routes/learn.tsx"), // Standalone route without layout for immersive mode
    route("login", "routes/auth/login.tsx"),
    route("register", "routes/auth/register.tsx"),
    route("logout", "routes/auth/logout.tsx"),
] satisfies RouteConfig;
