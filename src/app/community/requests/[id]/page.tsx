"use client";

import { use } from "react";
import { ItemDetail } from "@/components/community/ItemDetail";

export default function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ItemDetail id={id} />;
}
