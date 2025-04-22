import { db } from "~/server/db/index";
import { images } from "~/server/db/schema";
import type { InferSelectModel } from "drizzle-orm";

// Define the post type based on your schema
type Image = InferSelectModel<typeof images>;

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const dbImages = await db.query.images.findMany({
    orderBy: (model, { desc }) => desc(model.id),
  }) as Image[];  
  console.log("Database images:", dbImages);


  return (
    <main className="">
      <div className="mt-8">
        <h2 className="text-2xl font-bold">Gallery in progress</h2>
        {dbImages.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xl">Images from database:</h3>
            <ul>
              {[...dbImages, ...dbImages, ...dbImages].map((image, index) => (
                <div key={image.id + " " + index} className="flex flex-col w-48">
                  <img src={image.url} alt={image.name}/>
                  <div>{image.name}</div>
                </div>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
