"use client";

import { 
    UserButton,
    SignedIn,
    SignedOut,
    SignInButton
} from "@clerk/nextjs";
import { UploadButton } from "~/utils/uploadthing";

export default function TopNav() { 
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
            <UploadButton endpoint="imageUploader" />
            <UserButton />
          </SignedIn>
        </div>
      </nav>
    )
  }