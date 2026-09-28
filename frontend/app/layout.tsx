import "./globals.css";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { ReduceMotionProvider } from "@/lib/reduceMotion";
import { DataProvider } from "@/lib/data";
import { AuthProvider } from "@/lib/auth";
import { WeatherProvider } from "@/lib/WeatherProvider";
import WeatherBackdrop from "@/components/weather/WeatherBackdrop";
import { SeenProvider } from "@/lib/seen";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SmoothScroll from "@/components/layout/SmoothScroll";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata = {
  title: "AgriVision",
  description: "Upload a photo of a diseased crop leaf and get a diagnosis, advice in your language, and outbreak alerts.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-screen flex-col antialiased">
        <ReduceMotionProvider>
          <I18nProvider>
            <DataProvider>
              <AuthProvider>
                <SeenProvider>
                  <WeatherProvider>
                    <WeatherBackdrop />
                    <SmoothScroll />
                    <Header />
                    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
                    <Footer />
                  </WeatherProvider>
                </SeenProvider>
              </AuthProvider>
            </DataProvider>
          </I18nProvider>
        </ReduceMotionProvider>
      </body>
    </html>
  );
}
