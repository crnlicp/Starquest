import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  index("routes/welcome.tsx"),
  route("kid", "routes/kid.tsx", [
    index("routes/kid.home.tsx"),
    route(":childId", "routes/kid.child.tsx"),
    route(":childId/shop", "routes/kid.shop.tsx"),
    route(":childId/avatar", "routes/kid.avatar.tsx"),
  ]),
  layout("routes/parent.tsx", [
    route("parent", "routes/parent.home.tsx"),
    route("parent/onboarding", "routes/parent.onboarding.tsx"),
    route("parent/settings", "routes/parent.settings.tsx"),
    route("parent/log", "routes/parent.log.tsx"),
    route("parent/children/new", "routes/parent.child-new.tsx"),
    route("parent/children/:id", "routes/parent.child-edit.tsx"),
    route("parent/children/:id/report", "routes/parent.report.tsx"),
    route("parent/children/:id/avatar", "routes/parent.avatar.tsx"),
    route("parent/history", "routes/parent.history.tsx"),
    route("parent/behaviors", "routes/parent.behaviors.tsx"),
    route("parent/behaviors/new", "routes/parent.behavior-new.tsx"),
    route("parent/behaviors/:id", "routes/parent.behavior-edit.tsx"),
    route("parent/rewards", "routes/parent.rewards.tsx"),
    route("parent/rewards/new", "routes/parent.reward-new.tsx"),
    route("parent/rewards/:id", "routes/parent.reward-edit.tsx"),
    route("parent/approvals", "routes/parent.approvals.tsx"),
  ]),
] satisfies RouteConfig;
