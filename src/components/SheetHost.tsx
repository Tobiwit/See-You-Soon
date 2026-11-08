"use client";

import { useUI } from "./ui/ui-state";
import { ItemDetail } from "./wishlist/ItemDetail";
import { ItemForm } from "./wishlist/ItemForm";
import { VisitSheet } from "./wishlist/VisitSheet";
import { AssignSheet } from "./planner/AssignSheet";
import { TravelForm } from "./planner/TravelForm";
import { FixedForm } from "./planner/FixedForm";
import { PostcardView } from "./memories/PostcardView";
import { PostcardComposer } from "./memories/PostcardComposer";
import { MomentForm, MomentView } from "./memories/Moments";
import { Settings } from "./settings/Settings";

/** Renders the top-most sheet of the stack. */
export function SheetHost() {
  const { sheets } = useUI();
  const top = sheets[sheets.length - 1];
  if (!top) return null;
  const k = `${sheets.length}-${top.kind}-${"id" in top ? top.id : ""}`;
  switch (top.kind) {
    case "item":
      return <ItemDetail key={k} id={top.id} />;
    case "item-form":
      return <ItemForm key={k} id={top.id} />;
    case "visit":
      return <VisitSheet key={k} id={top.id} />;
    case "assign":
      return <AssignSheet key={k} id={top.id} />;
    case "travel":
      return <TravelForm key={k} id={top.id} date={top.date} />;
    case "fixed":
      return <FixedForm key={k} id={top.id} />;
    case "postcard":
      return <PostcardView key={k} id={top.id} />;
    case "compose":
      return <PostcardComposer key={k} />;
    case "moment-form":
      return <MomentForm key={k} />;
    case "moment":
      return <MomentView key={k} id={top.id} />;
    case "settings":
      return <Settings key={k} />;
  }
}
