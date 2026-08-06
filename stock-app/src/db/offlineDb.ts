import { openDB, type IDBPDatabase } from "idb";
import type { Producto } from "@/types";
import type { ConteoInput } from "@/lib/validations";

const DB_NAME = "stockapp-db";
const DB_VERSION = 1;

export interface ConteoLocal extends ConteoInput {
  localId?: number;
  descripcion: string;
  ubicacion: string;
  stockSap: number;
  diferencia: number;
  estado: "coincide" | "sobra" | "falta" | "no_existe";
  usuarioId: string;
  usuarioEmail: string;
  fecha: string;
  hora: string;
  synced: boolean;
  createdAt: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("stock")) {
          db.createObjectStore("stock", { keyPath: "codigo" });
        }
        if (!db.objectStoreNames.contains("counts")) {
          const store = db.createObjectStore("counts", { keyPath: "localId", autoIncrement: true });
          store.createIndex("synced", "synced");
          store.createIndex("codigo", "codigo");
        }
      },
    });
  }
  return dbPromise;
}

/* ---------- STOCK (cache local de productos) ---------- */

export async function cachearProductos(productos: Producto[]) {
  const db = await getDb();
  const tx = db.transaction("stock", "readwrite");
  await tx.store.clear();
  for (const p of productos) {
    await tx.store.put(p);
  }
  await tx.done;
}

export async function getProductosCache(): Promise<Producto[]> {
  const db = await getDb();
  return db.getAll("stock");
}

export async function getProductoCachePorCodigo(codigo: string): Promise<Producto | undefined> {
  const db = await getDb();
  const todos: Producto[] = await db.getAll("stock");
  return todos.find((p) => p.codigo.toLowerCase() === codigo.toLowerCase());
}

/* ---------- CONTEOS (cola offline) ---------- */

export async function encolarConteo(conteo: Omit<ConteoLocal, "localId" | "synced" | "createdAt">) {
  const db = await getDb();
  return db.add("counts", { ...conteo, synced: false, createdAt: Date.now() });
}

export async function getConteosLocales(): Promise<ConteoLocal[]> {
  const db = await getDb();
  return db.getAll("counts");
}

export async function getConteosPendientes(): Promise<ConteoLocal[]> {
  const todos = await getConteosLocales();
  return todos.filter((c) => !c.synced);
}

export async function marcarConteosSincronizados(localIds: number[]) {
  const db = await getDb();
  const tx = db.transaction("counts", "readwrite");
  for (const id of localIds) {
    const item = await tx.store.get(id);
    if (item) {
      item.synced = true;
      await tx.store.put(item);
    }
  }
  await tx.done;
}

export async function getHistorialLocalDeProducto(codigo: string): Promise<ConteoLocal[]> {
  const todos = await getConteosLocales();
  return todos
    .filter((c) => c.codigo.toLowerCase() === codigo.toLowerCase())
    .sort((a, b) => b.createdAt - a.createdAt);
}
