"use client";

import dynamic from "next/dynamic";
import AuthProvider from "@/app/components/AuthProvider";
import LoadingScreen from "@/app/components/LoadingScreen";

const Ledgerly = dynamic(() => import("@/app/components/Ledgerly"), {
  ssr: false,
  loading: () => <LoadingScreen />,
});

export default function Home() {
  return (
    <AuthProvider>
      <Ledgerly />
    </AuthProvider>
  );
}
