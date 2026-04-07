import { hostname } from "node:os";
import type { SshClient } from "../types";
import { SshConnection } from "./connection";
import { LocalClient } from "./local";

/** Check if a host string refers to the local machine */
export function isLocalHost(host: string): boolean {
  const h = host.replace(/^[^@]*@/, ""); // strip user@
  const localNames = ["localhost", "127.0.0.1", "::1", hostname()];
  return localNames.includes(h);
}

/** Connect to a server — returns LocalClient for local, SshConnection for remote */
export async function connectServer(host: string): Promise<SshClient> {
  if (isLocalHost(host)) {
    return new LocalClient();
  }
  const conn = new SshConnection(host);
  await conn.connect();
  return conn;
}
