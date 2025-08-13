// Serialization
export type Deserializer<T> = (value: string) => T;
export type Serializer<T> = (value: T) => string;

// Subscriptions
export type SubscriptionCallback<T> = (val: T) => void;
export type GeneralSubscriptionCallback = () => void;

// Timestamp
export type DateRange = [Date, Date];

// UUID
export type UUID = number;
