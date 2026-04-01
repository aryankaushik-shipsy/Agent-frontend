import type { Carrier } from './carrier'

export type HitlType = 1 | 2 | 3

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
