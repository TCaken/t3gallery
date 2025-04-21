import Link from "next/link";
import Image from "next/image";
import { db } from "~/server/db/index";
import { posts } from "~/server/db/schema";
import type { InferSelectModel } from "drizzle-orm";

const mockUrls = [
  "https://xzymzk73e9.ufs.sh/f/3SklIw8OvxkH2b6osNj0XDKLvBsqfGS7l5tRTFgr4Qea3Iy8",
  "https://xzymzk73e9.ufs.sh/f/3SklIw8OvxkHvuKzes7dqg2kUSHLjGFtaRd5y3J7CspvKEoc",
  "https://xzymzk73e9.ufs.sh/f/3SklIw8OvxkHkP2N5vb96qegH8LpD20SWFIjuodyaNtfwQ9Y",
  "https://xzymzk73e9.ufs.sh/f/3SklIw8OvxkHUFi4MZiQtrlR9KQ6pnEH5ydMe2IOxXbhPcio"
]

const mockImages = mockUrls.map((url, index) => ({
  id: index,
  url,
  title: `Mock Image ${index + 1}`,
  description: `Mock Description ${index + 1}`
}))

// Define the post type based on your schema
type Post = InferSelectModel<typeof posts>;

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let dbPosts: Post[] = [];
  
  try {
    // Type assertion to handle the query result
    dbPosts = await db.query.posts.findMany() as Post[];
    console.log("Database posts:", dbPosts);
  } catch (error) {
    console.error("Database error:", error instanceof Error ? error.message : String(error));
  }

  return (
    <main className="">
      <div className="flex flex-wrap gap-4">
        {mockImages.map((image) => (
          <div key={image.id} className="w-48">
            <img src={image.url} alt={image.title} />
          </div>
        ))}
      </div>
      <div className="mt-8">
        <h2 className="text-2xl font-bold">Gallery in progress</h2>
        {dbPosts.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xl">Posts from database:</h3>
            <ul>
              {dbPosts.map((post) => (
                <li key={post.id}>{post.name}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
