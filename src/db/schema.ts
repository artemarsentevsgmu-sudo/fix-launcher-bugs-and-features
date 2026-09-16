import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  username: text("username").notNull(),
  displayName: text("display_name").notNull(),
  cookie: text("cookie").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

/**
 * Локальный архив транзакций группы.
 * Roblox отдаёт историю крошечными порциями и быстро включает 429, поэтому
 * график строится из накопленных данных, а не качается заново каждый раз.
 */
export const salesTx = pgTable(
  "sales_tx",
  {
    id: serial("id").primaryKey(),
    groupId: text("group_id").notNull(),
    txId: text("tx_id").notNull(),
    type: text("type").notNull(),
    created: timestamp("created", { mode: "date" }).notNull(),
    amount: integer("amount").notNull().default(0),
    itemId: text("item_id"),
    itemName: text("item_name"),
    agentName: text("agent_name"),
  },
  (t) => ({
    uniq: uniqueIndex("sales_tx_uniq").on(t.groupId, t.type, t.txId),
    byGroupDate: index("sales_tx_group_date").on(t.groupId, t.created),
  })
);

/** Состояние докачки истории по каждой паре группа+тип. */
export const syncState = pgTable(
  "sync_state",
  {
    id: serial("id").primaryKey(),
    groupId: text("group_id").notNull(),
    type: text("type").notNull(),
    cursor: text("cursor"),
    oldestCreated: timestamp("oldest_created", { mode: "date" }),
    newestCreated: timestamp("newest_created", { mode: "date" }),
    complete: boolean("complete").notNull().default(false),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => ({
    uniq: uniqueIndex("sync_state_uniq").on(t.groupId, t.type),
  })
);

export type AccountRow = typeof accounts.$inferSelect;
export type SalesTxRow = typeof salesTx.$inferSelect;
