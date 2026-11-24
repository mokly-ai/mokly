import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  ChevronRight,
  ChevronsUpDown,
  CircleAlert,
  CreditCard,
  Ellipsis,
  Github,
  GitBranch,
  GitPullRequest,
  History,
  Inbox,
  KeyRound,
  LayoutGrid,
  Lock,
  LogOut,
  Plus,
  RotateCw,
  Search,
  Settings,
  Shield,
  SquareLibrary,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

/**
 * One icon vocabulary for the Folio product chrome. Every glyph is drawn at a
 * single stroke width in the inherited text color, so an icon always matches
 * the weight and tone of the label beside it.
 */
export const iconStroke = 1.5;

/** Chrome glyphs sit on the 16px row grid; 20px is the standalone state size. */
export const iconSize = { row: 16, state: 20 } as const;

export const icons = {
  account: UserRound,
  access: Shield,
  back: ArrowLeft,
  billing: CreditCard,
  branch: GitBranch,
  close: X,
  danger: Trash2,
  empty: Inbox,
  external: ArrowUpRight,
  github: Github,
  history: History,
  members: Users,
  more: Ellipsis,
  next: ChevronRight,
  workspace: Building2,
  private: Lock,
  problem: CircleAlert,
  project: SquareLibrary,
  pullRequest: GitPullRequest,
  retry: RotateCw,
  search: Search,
  settings: Settings,
  signOut: LogOut,
  start: Plus,
  switcher: ChevronsUpDown,
  tokens: KeyRound,
  workspaces: LayoutGrid,
} as const satisfies Record<string, LucideIcon>;

/** The glyph names the chrome may draw; screens never reach past this set. */
export type IconName = keyof typeof icons;

/**
 * A decorative glyph beside a label. The neighbouring text names the item, so
 * the icon stays out of the accessibility tree.
 */
export function Icon({
  name,
  size = iconSize.row,
}: {
  name: IconName;
  size?: number;
}) {
  const Glyph = icons[name];
  return (
    <Glyph
      size={size}
      strokeWidth={iconStroke}
      color="currentColor"
      aria-hidden
    />
  );
}
