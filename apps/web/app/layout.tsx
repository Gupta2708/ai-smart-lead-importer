import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "GrowEasy | CSV Import", description: "AI-powered lead importer" };
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
