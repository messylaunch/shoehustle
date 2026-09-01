import { Notice } from "@/components/ui";
import { hasAnthropicKey } from "@/lib/config";
import PriceForm from "./PriceForm";

export const metadata = { title: "Price a pair" };
export const dynamic = "force-dynamic";

export default async function PricePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <>
      <h1>Price a pair</h1>
      <p className="muted prose">
        Photograph it, confirm what it is, and the next screen tells you the
        most you can pay for it.
      </p>

      {error === "missing" ? (
        <Notice kind="bad" title="Missing something">
          Brand, model and size are the three I can't work without.
        </Notice>
      ) : null}

      <PriceForm photoIdOn={hasAnthropicKey} />
    </>
  );
}
