import { getMyImages } from "~/server/db/queries";
import { SignedIn, SignedOut } from "@clerk/nextjs";

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
        <div className="flex flex-wrap gap-4">
        {dbImages.map((image) => (
          <div key={image.id} className="flex flex-col w-48">
            <img src={image.url} alt={image.name}/>
            <div>{image.name}</div>
          </div>
        ))} 
      </div>
      </SignedIn>
    </main>
  );
}
