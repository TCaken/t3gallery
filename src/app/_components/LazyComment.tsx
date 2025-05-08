'use client';

import { useState, useEffect } from 'react';
import { ChatBubbleLeftIcon } from '@heroicons/react/24/outline';
import { getLeadComments } from '~/app/_actions/commentActions';
import { useRouter } from 'next/navigation';

interface LazyCommentProps {
  leadId: number;
}

interface Comment {
  id: number;
  content: string;
  createdAt: Date;
  createdBy: string | null;
}

export default function LazyComment({ leadId }: LazyCommentProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const loadComments = async () => {
    if (!isHovered) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await getLeadComments(leadId);
      if (result.success && result.comments) {
        setComments(result.comments);
      } else {
        setError(result.error ?? 'Failed to load comments');
      }
    } catch (err) {
      setError('An error occurred while loading comments');
      console.error('Error loading comments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isHovered) {
      void loadComments();
    }
  }, [isHovered, leadId]);

  const handleViewAllComments = () => {
    router.push(`/dashboard/leads/${leadId}?tab=comments`);
  };

  return (
    <div className="relative">
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="flex items-center text-sm text-gray-500 hover:text-gray-700 cursor-pointer group"
      >
        <span className="ml-1 text-xs opacity-50 group-hover:opacity-100 transition-opacity">
          Hover to view comments
        </span>
      </div>

      {isHovered && (
        <div 
          className="absolute z-50 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 p-3"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
            </div>
          ) : (
            <>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {comments.length === 0 ? (
                  <div className="text-sm text-gray-500 text-center py-2">
                    No comments yet
                  </div>
                ) : (
                  comments.slice(0, 3).map((comment) => (
                    <div key={comment.id} className="text-sm bg-gray-50 p-2 rounded border border-gray-100">
                      <p className="text-gray-700 line-clamp-2">{comment.content}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(comment.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
              
              {comments.length > 3 && (
                <button
                  onClick={handleViewAllComments}
                  className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium mt-2 py-1 border-t border-gray-100"
                >
                  View all {comments.length} comments
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
} 