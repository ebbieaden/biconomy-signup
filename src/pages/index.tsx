import dynamic from "next/dynamic";
//use inter from next/font
import { Inter } from "next/font/google";
import { Suspense } from "react";

// Dynamically import the 'Wallet' component to make sure we don't get SSR servers
const Wallet = dynamic(
  () => import("../components/Wallet").then((res) => res.default),
  { ssr: false }
);

const inter = Inter({ subsets: ["latin"] });

export default function home() {
  return(
    <main className={inter.className}>
      <Suspense fallback={<div>Loading...</div>}>
        <Wallet/>
      </Suspense>
    </main>
  );
}