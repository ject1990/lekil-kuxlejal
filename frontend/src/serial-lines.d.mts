export class SerialLines {
  constructor(onLine: (line: string, received: number) => void, onError: (message: string) => void)
  push(bytes: Uint8Array, now: number): void
  expire(now: number): void
}
