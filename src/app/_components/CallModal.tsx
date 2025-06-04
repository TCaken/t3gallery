'use client';

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { PhoneIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  phoneNumber: string;
  leadName?: string;
}

export default function CallModal({
  isOpen,
  onClose,
  onConfirm,
  phoneNumber,
  leadName
}: CallModalProps) {
  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[100]" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/70 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-xl transition-all sm:my-8 w-full sm:max-w-2xl">
                <div className="bg-white px-8 pb-8 pt-6 sm:p-8">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:ml-6 sm:mt-0 sm:text-left flex-1">
                      <Dialog.Title as="h3" className="text-2xl font-semibold leading-6 text-gray-900 mb-4">
                        Confirm Call
                      </Dialog.Title>
                      <div className="mt-4">
                        <div className="bg-gray-50 rounded-lg p-6 mb-6">
                          {leadName && (
                            <div className="mb-4">
                              <p className="text-sm text-gray-500">Lead Name</p>
                              <p className="text-lg font-medium text-gray-900">{leadName}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-sm text-gray-500">Phone Number</p>
                            <p className="text-lg font-medium text-gray-900">{phoneNumber}</p>
                          </div>
                        </div>
                        <p className="text-base text-gray-600">
                          Are you sure you want to initiate a call to this lead? The call will be connected through Samespace.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-8 sm:flex sm:flex-row-reverse gap-3">
                    <button
                      type="button"
                      className="inline-flex w-full justify-center rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-500 sm:w-auto"
                      onClick={() => {
                        onConfirm();
                        onClose();
                      }}
                    >
                      Call Now
                    </button>
                    <button
                      type="button"
                      className="mt-3 inline-flex w-full justify-center rounded-lg bg-white px-6 py-3 text-base font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                      onClick={onClose}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
} 