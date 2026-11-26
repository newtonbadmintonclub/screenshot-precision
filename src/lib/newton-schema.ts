// Schema additions for the club's own Supabase project.
//
// The platform-generated `@/integrations/supabase/types` still describes the
// old Lovable Cloud instance, so it is missing the tables and functions that
// exist in the club's database (inventory, refunds, admin audit trails, AI
// sync). This module merges those real definitions into the generated type so
// the app's own clients are typed against the database they actually talk to.
//
// Column shapes below were read from the live project's PostgREST schema.
import type { Database } from "@/integrations/supabase/types";

type NoRelationships = [];

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: NoRelationships;
};

type InventoryItemRow = {
  id: string;
  sku: string | null;
  name: string;
  category: string;
  description: string;
  unit: string;
  quantity: number;
  minimum_quantity: number;
  location: string;
  condition_status: string;
  unit_cost: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type InventoryMovementRow = {
  id: string;
  item_id: string;
  movement_type: string;
  quantity_change: number;
  previous_quantity: number;
  new_quantity: number;
  reason: string;
  reference: string | null;
  actor_id: string;
  created_at: string;
};

type RefundRequestRow = {
  id: string;
  booking_id: string;
  request_id: string | null;
  user_id: string;
  amount: number;
  payment_method: string;
  status: string;
  reason: string | null;
  admin_note: string | null;
  external_reference: string | null;
  reviewed_by: string | null;
  processed_by: string | null;
  completed_by: string | null;
  requested_at: string;
  reviewed_at: string | null;
  processed_at: string | null;
  completed_at: string | null;
  updated_at: string;
};

type RefundActionRow = {
  id: string;
  refund_id: string;
  actor_id: string;
  action: string;
  reason: string | null;
  external_reference: string | null;
  created_at: string;
};

type BookingActionRow = {
  id: string;
  booking_id: string;
  request_id: string | null;
  actor_id: string;
  action: string;
  reason: string | null;
  created_at: string;
};

type AiSyncSettingsRow = {
  id: string;
  jalur_1_active: boolean;
  jalur_2_active: boolean;
  jalur_3_active: boolean;
  anti_loop_active: boolean;
  send_delay_seconds: number;
  bot_wa_number: string;
  trigger_keyword: string;
  waha_api_url: string;
  wa_group_id: string;
  instagram_page_id: string;
  updated_at: string;
};

type AiSyncLogRow = {
  id: string;
  channel_flow: string;
  description: string;
  payload_json: Record<string, unknown>;
  status: string;
  created_at: string;
};

type AiAgentProfileRow = {
  id: string;
  agent_key: string;
  name: string;
  model: string;
  system_prompt: string;
  welcome_message: string;
  is_active: boolean;
  temperature: number;
  max_output_tokens: number;
  updated_at: string;
  updated_by: string | null;
};

type AiIntegrationStatusRow = {
  id: string;
  provider: string;
  display_name: string;
  configured: boolean;
  endpoint_url: string | null;
  external_account_id: string | null;
  last_checked_at: string | null;
  last_error: string | null;
  updated_at: string;
};

type NewtonTables = {
  inventory_items: Table<
    InventoryItemRow,
    {
      id?: string;
      sku?: string | null;
      name: string;
      category: string;
      description?: string;
      unit?: string;
      quantity?: number;
      minimum_quantity?: number;
      location?: string;
      condition_status?: string;
      unit_cost?: number | null;
      is_active?: boolean;
      created_at?: string;
      updated_at?: string;
    },
    Partial<InventoryItemRow>
  >;
  inventory_movements: Table<
    InventoryMovementRow,
    {
      id?: string;
      item_id: string;
      movement_type: string;
      quantity_change: number;
      previous_quantity?: number;
      new_quantity?: number;
      reason?: string;
      reference?: string | null;
      actor_id?: string;
      created_at?: string;
    },
    Partial<InventoryMovementRow>
  >;
  refund_requests: Table<
    RefundRequestRow,
    {
      id?: string;
      booking_id: string;
      request_id?: string | null;
      user_id: string;
      amount: number;
      payment_method: string;
      status?: string;
      reason?: string | null;
      admin_note?: string | null;
      external_reference?: string | null;
      reviewed_by?: string | null;
      processed_by?: string | null;
      completed_by?: string | null;
      requested_at?: string;
      reviewed_at?: string | null;
      processed_at?: string | null;
      completed_at?: string | null;
      updated_at?: string;
    },
    Partial<RefundRequestRow>
  >;
  refund_admin_actions: Table<
    RefundActionRow,
    {
      id?: string;
      refund_id: string;
      actor_id?: string;
      action: string;
      reason?: string | null;
      external_reference?: string | null;
      created_at?: string;
    },
    Partial<RefundActionRow>
  >;
  booking_admin_actions: Table<
    BookingActionRow,
    {
      id?: string;
      booking_id: string;
      request_id?: string | null;
      actor_id?: string;
      action: string;
      reason?: string | null;
      created_at?: string;
    },
    Partial<BookingActionRow>
  >;
  ai_sync_settings: Table<
    AiSyncSettingsRow,
    AiSyncSettingsRow,
    Partial<AiSyncSettingsRow>
  >;
  ai_sync_logs: Table<AiSyncLogRow, AiSyncLogRow, Partial<AiSyncLogRow>>;
  ai_agent_profiles: Table<
    AiAgentProfileRow,
    AiAgentProfileRow,
    Partial<AiAgentProfileRow>
  >;
  ai_integration_status: Table<
    AiIntegrationStatusRow,
    AiIntegrationStatusRow,
    Partial<AiIntegrationStatusRow>
  >;
  // Feature-image columns that the live `events` table has but the stale
  // generated type does not.
  events: Table<
    { image_url: string | null; image_path: string | null },
    { image_url?: string | null; image_path?: string | null },
    { image_url?: string | null; image_path?: string | null }
  >;
};

type NewtonFunctions = {
  accept_waitlist_offer: {
    Args: { _booking_id: string; _payment_method: string };
    Returns: unknown;
  };
  admin_review_booking: {
    Args: {
      _booking_id: string;
      _action: string;
      _request_id?: string | null;
      _reason?: string | null;
    };
    Returns: unknown;
  };
  admin_update_refund_status: {
    Args: {
      _refund_id: string;
      _status: string;
      _reason?: string | null;
      _external_reference?: string | null;
    };
    Returns: unknown;
  };
  inventory_adjust_stock: {
    Args: {
      p_item_id: string;
      p_movement_type: string;
      p_quantity_change: number;
      p_reason: string;
      p_reference?: string | null;
    };
    Returns: unknown;
  };
  submit_booking_transfer_proof: {
    Args: { _booking_id: string; _proof_path: string };
    Returns: unknown;
  };
};

export type NewtonDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables" | "Functions"> & {
    Tables: Database["public"]["Tables"] & NewtonTables;
    Functions: Database["public"]["Functions"] & NewtonFunctions;
  };
};
