import { Sidebar } from "@/components/insight/Sidebar";

type RebuildHoldWorkspaceProps = {
  workspace: string;
  identityKey: string;
};

/**
 * Deliberately blank rebuild hold.
 *
 * The route and sidebar identity stay intact while the previous visual/content
 * implementation is hidden. The preserved product identity and source-of-truth
 * implementation paths are documented in:
 * docs/workspace-identities/rebuild-hold-pages.md
 */
export default function RebuildHoldWorkspace({
  workspace,
  identityKey,
}: RebuildHoldWorkspaceProps) {
  return (
    <div
      className="min-h-screen bg-[#06090d]"
      data-rebuild-hold="true"
      data-workspace={workspace}
      data-page-identity={identityKey}
    >
      <Sidebar />
      <main
        aria-hidden="true"
        className="min-h-screen bg-transparent lg:ml-[210px]"
      />
    </div>
  );
}
