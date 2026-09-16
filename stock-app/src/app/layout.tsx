import type { Metadata, Viewport } from "next";
import { Inter, Archivo, Rajdhani, JetBrains_Mono } from "next/font/google";
import { AppProviders } from "@/providers/AppProviders";
import { PwaRegister } from "@/components/layout/PwaRegister";
import { ToastProvider } from "@/components/layout/ToastProvider";
import { AvisoActualizacion } from "@/components/layout/AvisoActualizacion";
import "./globals.css";

/*
  Las tres familias del sistema, servidas por next/font: se descargan en el
  build y se sirven desde el propio dominio, sin pedido a Google en runtime.
  Importa para una PWA que tiene que arrancar en un depósito con señal mala
  -- antes las fuentes se declaraban solo por nombre en globals.css, así que
  si Inter no estaba instalada en el dispositivo se caía a la del sistema.

  Cada una expone su variable CSS, que es la que consume tailwind.config.ts.
*/
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Grotesca industrial, emparentada con la cartelería de depósito. Solo para
// titulación y cifras grandes -- le da carácter propio a la app sin tocar la
// legibilidad de la interfaz, que sigue siendo Inter.
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

/*
  Rajdhani -- la única cara "de instrumento" del sistema, y por eso está
  acotada a un solo lugar: las cifras del tablero ABC.

  No reemplaza a Archivo. Archivo es la voz de la app entera; esta es la de
  un panel de control, con numerales angostos y cuadrados que a 44px se leen
  como display de tablero y no como titular de documento. Usarla en más
  pantallas la convertiría en decoración y le sacaría el efecto justamente
  donde sirve.
*/
const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-hud",
  display: "swap",
});

// Códigos SKU, ubicaciones y timestamps: ancho fijo para que las columnas
// numéricas no bailen al actualizarse.
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
  display: "swap",
});

const COLOR_OSCURO = "#100c0a";
const COLOR_CLARO = "#faf8f5";

/*
  Tema oscuro por defecto, aplicado ANTES del primer pintado.

  Este script corre de forma bloqueante en el <head>, o sea antes de que el
  navegador dibuje nada. Sin esto habría un flash blanco en cada carga: el
  tema se decidía recién en un useEffect del Topbar, después de la
  hidratación, así que la app se pintaba clara y recién ahí se oscurecía.
  Con el oscuro como identidad, ese parpadeo pasaría a verse en cada entrada.

  El default es oscuro y no la preferencia del sistema: es una decisión de
  producto, el oscuro es la identidad de StockApp. Quien haya elegido claro
  a mano lo tiene guardado en localStorage y eso siempre gana.

  Va con try/catch porque en navegación privada de algunos navegadores leer
  localStorage tira excepción -- y si eso pasa, igual queremos el oscuro.
*/
const scriptTema = `
(function(){
  try{
    var g = localStorage.getItem('theme');
    var oscuro = g ? g === 'dark' : true;
    document.documentElement.classList.toggle('dark', oscuro);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', oscuro ? '${COLOR_OSCURO}' : '${COLOR_CLARO}');
  }catch(e){
    document.documentElement.classList.add('dark');
  }
})();
`;

export const metadata: Metadata = {
  title: "StockApp — Conteo de Inventario",
  description: "Sistema profesional de conteo de stock físico vs SAP",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "StockApp",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  /*
    Un solo valor, no uno por prefers-color-scheme: el tema ya no lo decide
    el sistema operativo sino la app (oscuro por defecto). El script de
    arriba y el botón del Topbar actualizan esta misma etiqueta cuando se
    cambia de tema, así que la barra de estado del teléfono siempre acompaña
    al color real de la app.
  */
  themeColor: COLOR_OSCURO,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${inter.variable} ${archivo.variable} ${rajdhani.variable} ${jetbrains.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body className="font-sans">
        <AppProviders>{children}</AppProviders>
        <ToastProvider />
        <PwaRegister />
        {/*
          Va en el layout raíz y no en una pantalla: el aviso de versión nueva
          tiene que alcanzar a todo el mundo, esté donde esté parado. Un
          operario puede pasarse el día entero en "Contar stock" sin volver al
          dashboard nunca.
        */}
        <AvisoActualizacion />
      </body>
    </html>
  );
}
