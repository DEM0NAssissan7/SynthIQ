// JSON
export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONObject
  | JSONArray;
export interface JSONObject {
  [key: string]: JSONValue;
}
export interface JSONArray extends Array<JSONValue> {}

// Serialization
export type Deserializer<T> = (o: any) => T;
export type Serializer<T> = (value: T) => JSONValue;

// Subscriptions
export type SubscriptionCallback<T> = (val: T) => void;
export type GeneralSubscriptionCallback = () => void;

// Timestamp
export type DateRange = [Date, Date];

// UUID
export type UUID = number;
