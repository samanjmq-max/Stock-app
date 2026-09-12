/**
 * bwip-js declara sus tipos vía "exports" condicionales por entorno
 * (browser/node/electron/react-native) sin una condición plana en la raíz.
 * Con moduleResolution "bundler" (el que usa este proyecto, recomendado
 * para Next.js App Router) TypeScript no logra resolver esa forma de
 * exports y reporta "Cannot find module 'bwip-js'" aunque el paquete esté
 * instalado y funcione perfecto en runtime. Shim mínimo, con la única
 * forma que se usa acá (api/etiquetas/pdf/route.ts, runtime nodejs).
 */
declare module "bwip-js" {
  interface ToBufferOptions {
    bcid: string;
    text: string;
    scale?: number;
    height?: number;
    includetext?: boolean;
    backgroundcolor?: string;
    [key: string]: unknown;
  }

  const bwipjs: {
    toBuffer(options: ToBufferOptions): Promise<Buffer>;
  };

  export default bwipjs;
}
