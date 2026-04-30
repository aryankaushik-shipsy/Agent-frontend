import type { Carrier } from './carrier'

export type HitlType = 1 | 2 | 3 | 4

export interface ShipmentItem {
  origin: string
  destination: string
  mode: string
  weight_kg: number
  date: string
  length_cm: number
  width_cm: number
  height_cm: number
  number_of_boxes: number
  incoterms?: string
  commodity?: string
}

export interface Type1Payload {
  items: ShipmentItem[]
}

export interface Type2Payload {
  carriers: Carrier[]
  origin?: string
  destination?: string
  weight_kg?: number
}

// Vendor RFQ standby — fires when no rates exist in the master for the lane,
// so the agent has emailed carriers and is waiting on quotes. Read-only card;
// the flow auto-rejoins the standard Type 2 path once a vendor responds.
export interface VendorContact {
  name: string
  email?: string
}

export interface Type4Payload {
  // Either a list of carrier names or {name, email} objects — render handles both.
  vendors: Array<string | VendorContact>
  lane?: string
  mode?: string
  ready_date?: string
  validity_requested_days?: number
  expected_response_by?: string
  rfq_sent_at?: string
}
