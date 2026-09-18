import { createRouter, Navigate } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

function DefaultNotFound() {
  return <Navigate to="/" replace />;
}

export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    defaultNotFoundComponent: DefaultNotFound,
  });
}
