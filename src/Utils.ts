export type TupleLiteralToUnion<Arr extends any[], V = keyof Arr> = V extends keyof Arr
    ? Arr[V] extends string ? Arr[V] : never
    : never;
