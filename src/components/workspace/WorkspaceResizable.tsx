"use client";

import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import type { ReactNode } from "react";

interface WorkspaceResizableProps {
  middle: ReactNode;
  right: ReactNode;
}

/**
 * Drag-to-resize split between the chat pane (middle) and the route content
 * (right). The ratio persists in localStorage via `autoSaveId` so the user's
 * preferred split is restored on next visit.
 *
 * `minSize` keeps each side usable — middle ≥ 25% (chat composer needs room),
 * right ≥ 20% (lists/details need to be legible). The handle has a wide hit
 * target (12px) but renders as a thin 1px line, the standard pattern for
 * desktop split-view UIs.
 */
export function WorkspaceResizable({ middle, right }: WorkspaceResizableProps) {
  return (
    <PanelGroup
      direction="horizontal"
      autoSaveId="campfire-workspace-split"
      className="!overflow-visible"
    >
      <Panel defaultSize={50} minSize={25} className="min-w-0">
        <div className="h-full pr-3">{middle}</div>
      </Panel>
      <PanelResizeHandle className="group relative flex w-3 items-stretch justify-center">
        <div className="w-px bg-border transition-colors group-hover:bg-accent group-data-[resize-handle-active]:bg-accent" />
      </PanelResizeHandle>
      <Panel defaultSize={50} minSize={20} className="min-w-0">
        <div className="h-full pl-3">{right}</div>
      </Panel>
    </PanelGroup>
  );
}
