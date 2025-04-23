import { SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import { getMyImages } from "~/server/db/queries";

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const dbImages = await getMyImages();

  return (
    <main className="">
      <SignedOut>
        <div className="h-full w-full text-2xl flex justify-center items-center">
          Please sign in above
        </div>
      </SignedOut>
      <SignedIn>
        <h3 className="text-xl">Images from database:</h3>
        <div className="flex flex-wrap justify-center gap-4">
        {dbImages.map((image) => (
          <div key={image.id} className="flex flex-col h-48 w-48">
            <Link href={`/img/${image.id}`}>
              <Image 
                src={image.url}
                style={{
                  objectFit: 'contain',
                }}
                alt={image.name}
                width={192}
                height={192}
              />
              <div>{image.name}</div>
            </Link>
          </div>
        ))} 
      </div>
      </SignedIn>
    </main>
  );
}
