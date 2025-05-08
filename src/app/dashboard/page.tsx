import { getCurrentUserId } from "../_actions/userActions";

export default async function DashboardHomePage() {
  const userId = await getCurrentUserId();
  console.log('Current User ID:', userId);
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard Overview</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">Total Leads</h2>
          <p className="text-3xl font-bold">128</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">Conversion Rate</h2>
          <p className="text-3xl font-bold">24%</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">Monthly Revenue</h2>
          <p className="text-3xl font-bold">$12,450</p>
        </div>
      </div>
      
      <div className="mt-8 bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        <div className="space-y-4">
          {/* Sample activities */}
          <div className="pb-4 border-b">
            <p className="font-medium">New lead captured</p>
            <p className="text-sm text-gray-500">2 hours ago</p>
          </div>
          <div className="pb-4 border-b">
            <p className="font-medium">Customer meeting scheduled</p>
            <p className="text-sm text-gray-500">Yesterday at 3:45 PM</p>
          </div>
          <div className="pb-4 border-b">
            <p className="font-medium">Report generated</p>
            <p className="text-sm text-gray-500">Yesterday at 10:30 AM</p>
          </div>
        </div>
      </div>
    </div>
  );
}
