"use client";

import { 
    UserButton,
    SignedIn,
    SignedOut,
    SignInButton
} from "@clerk/nextjs";
import { UploadButton } from "~/utils/uploadthing";
import { useRouter } from "next/navigation";

export default function TopNav() {
  const router = useRouter();
  
  return (
    <nav className="flex justify-between items-center w-full p-4 text-xl font-semibold border-b">
      <div>
        Gallery
      </div>
      <div className="flex flex-row gap-4">
        <SignedOut>
          <SignInButton />
        </SignedOut>
        <SignedIn>
          <UploadButton endpoint="imageUploader" onClientUploadComplete={() => {
            router.refresh();
          }}  />
          <UserButton />
        </SignedIn>
      </div>
    </nav>
    )
  }