// Shared payload types between API routes and client.

export interface AccountInfo {
  id: number;
  userId: string;
  username: string;
  displayName: string;
  createdAt: string | null;
}

export interface MeInfo {
  userId: number;
  name: string;
  displayName: string;
  description: string;
  created: string;
  robux: number | null;
  friends: number;
  followers: number;
  following: number;
  headshot: string | null;
}

export interface FriendPresence {
  id: number;
  name: string;
  displayName: string;
  headshot: string | null;
  presence: 0 | 1 | 2 | 3; // 0 offline, 1 online, 2 in game, 3 studio
  location: string | null;
  placeId: number | null;
  rootPlaceId: number | null;
  gameId: string | null;
  universeId: number | null;
  lastOnline: string | null;
}

export interface GroupEntry {
  id: number;
  name: string;
  memberCount: number;
  icon: string | null;
  hasVerifiedBadge: boolean;
  role: { id: number; name: string; rank: number };
  isOwner: boolean; // rank >= 254
  canManage: boolean; // rank >= 100 (модератор и выше)
}

export interface GroupDetail {
  id: number;
  name: string;
  description: string;
  memberCount: number;
  icon: string | null;
  hasVerifiedBadge: boolean;
  publicEntryAllowed: boolean;
  isLocked: boolean;
  owner: { userId: number; username: string; displayName: string } | null;
  shout: { body: string; poster: string; created: string } | null;
  funds: number | null;
  roles: { id: number; name: string; rank: number; memberCount?: number }[];
  members: {
    userId: number;
    username: string;
    displayName: string;
    headshot: string | null;
    roleName: string;
    rank: number;
  }[];
  membersTruncated: boolean;
}

export interface TxItem {
  id: number;
  created: string;
  type: string;
  agent: { id: number; name: string; type: string };
  amount: number;
  isPending: boolean;
  headshot: string | null;
  /** Что именно продали/купили */
  item: {
    id: number | null;
    name: string | null;
    type: string | null;
    image: string | null;
  } | null;
}

export interface TxPage {
  balance: number | null;
  items: TxItem[];
  nextCursor: string | null;
  prevCursor: string | null;
}

export interface CatalogItem {
  id: number;
  name: string;
  price: number | null;
  favoriteCount: number;
  assetType: string;
  isLimited: boolean;
  image: string | null;
}

export interface CatalogPage {
  items: CatalogItem[];
  nextCursor: string | null;
}

export interface RecCard {
  id: number;
  name: string;
  price: number | null;
  assetType: string;
  image: string | null;
  url: string;
}

export interface RecRail {
  title: string;
  items: RecCard[];
}

export interface DayPoint {
  date: string; // ISO yyyy-mm-dd
  sales: number;
  commissions: number;
  payouts: number;
  salesCount: number;
}

export interface SalesReport {
  days: DayPoint[];
  totalSales30d: number;
  totalSales7d: number;
  txCount30d: number;
  payouts30d: number;
  pointsSampled: number;
  samplingCapped: boolean;
  topBuyers: { name: string; spent: number; count: number }[];
}

export interface ChallengeState {
  outerChallengeId: string;
  challengeType: string;
  userId: number;
  challengeId: string; // вложенный id для twostepverification
}

export interface PayoutRecipient {
  username: string;
  amount: number;
}

export interface ResolvedUser {
  username: string;
  requested: string;
  userId: number;
  headshot: string | null;
  ok: boolean;
}
