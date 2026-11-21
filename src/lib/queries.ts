import { queryOptions } from "@tanstack/react-query";
import { listEvents, listProducts } from "./public.functions";

export const eventsQuery = () =>
  queryOptions({ queryKey: ["events"], queryFn: () => listEvents(), staleTime: 20_000 });

export const productsQuery = () =>
  queryOptions({ queryKey: ["products"], queryFn: () => listProducts(), staleTime: 60_000 });
