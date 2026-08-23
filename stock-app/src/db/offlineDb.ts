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

/**
 * Una vez que un conteo se subió al servidor, se ELIMINA de la base local.
 * Antes solo se marcaba como sincronizado y quedaba guardado para siempre,
 * lo que hacía que la app siguiera mostrando conteos viejos (incluso ya
 * borrados del servidor) al recargar la página. El servidor es la única
 * fuente de verdad: lo local es solo una cola temporal de lo que falta subir.
 */
export async function marcarConteosSincronizados(localIds: number[]) {
  const db = await getDb();
  const tx = db.transaction("counts", "readwrite");
  for (const id of localIds) {
    await tx.store.delete(id);
  }
  await tx.done;
}

/**
 * Limpia de la base local todos los conteos que ya fueron sincronizados en
 * algún momento (registros viejos que quedaron acumulados antes de la
 * corrección). No toca los pendientes de subir.
 */
export async function limpiarConteosSincronizados(): Promise<number> {
  const db = await getDb();
  const todos: ConteoLocal[] = await db.getAll("counts");
  const yaSincronizados = todos.filter((c) => c.synced && c.localId !== undefined);

  if (yaSincronizados.length === 0) return 0;

  const tx = db.transaction("counts", "readwrite");
  for (const c of yaSincronizados) {
    await tx.store.delete(c.localId!);
  }
  await tx.done;

  return yaSincronizados.length;
}

export async function getHistorialLocalDeProducto(codigo: string): Promise<ConteoLocal[]> {
  const todos = await getConteosLocales();
  return todos
    .filter((c) => c.codigo.toLowerCase() === codigo.toLowerCase())
    .sort((a, b) => b.createdAt - a.createdAt);
}
