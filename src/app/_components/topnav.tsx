import { 
    UserButton,
    SignedIn,
    SignedOut,
    SignInButton
} from "@clerk/nextjs";

export default function TopNav() { 
    return (
      <nav className="flex justify-between items-center w-full p-4 text-xl font-semibold border-b">
        <div>
          Gallery
        </div>
        <div>
            <SignedOut>
                <SignInButton />
            </SignedOut>
            <SignedIn>
                <UserButton />
            </SignedIn>
        </div>
      </nav>
    )
  }