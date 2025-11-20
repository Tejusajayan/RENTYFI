import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import TopBar from "@/components/TopBar";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, AlertCircle, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
export default function Backup() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { toast } = useToast();
  const user = useAuth();

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/backup/export', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to export data');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = response.headers.get('Content-Disposition')
        ?.split('filename=')[1]
        ?.replace(/"/g, '') || `propertyfinance-backup-${new Date().toISOString().split('T')[0]}.json`;
      
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "Data exported successfully!",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to export data",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        setSelectedFile(file);
      } else {
        toast({
          title: "Error",
          description: "Please select a valid JSON file",
          variant: "destructive",
        });
      }
    }
  };

  const handleImportData = async () => {
    if (!selectedFile) {
      toast({
        title: "Error",
        description: "Please select a file to import",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append("backup", selectedFile);

      const response = await fetch('/api/backup/import', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const result = await response.json();
      
      if (!response.ok) {
        // Show detailed error from backend if available
        toast({
          title: "Error",
          description: result?.message
            ? `${result.message}${result.error ? `: ${result.error}` : ""}${result.restoreError ? ` (Restore error: ${result.restoreError})` : ""}`
            : "Failed to import data",
          variant: "destructive",
        });
        setIsImporting(false);
        return;
      }

      toast({
        title: "Success",
        description: "Data imported successfully! Please reload the page to see the changes.",
      });
      // Clear the file input
      if (document.getElementById('backup-file')) {
        (document.getElementById('backup-file') as HTMLInputElement).value = '';
      }
      setSelectedFile(null);
      // --- Add this line to reload the page after import ---
      window.location.reload();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to import data",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <TopBar title="Backup & Restore" user={user} />
      <div className="p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Backup & Restore</h2>
            <p className="text-gray-600">
              Export your data for safekeeping or import from a previous backup
            </p>
          </div>

          {/* Export Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Download className="h-5 w-5" />
                <span>Export Data</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600">
                Download a complete backup of all your financial data including transactions, 
                accounts, categories, buildings, shops, tenants, and rent payments.
              </p>
              
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  The exported file contains all your data in JSON format and can be used 
                  to restore your information on this or another device.
                </AlertDescription>
              </Alert>
              
              <div className="flex items-center space-x-4">
                <Button 
                  onClick={handleExportData}
                  disabled={isExporting}
                  className="flex items-center space-x-2"
                >
                  <Download className="h-4 w-4" />
                  <span>{isExporting ? "Exporting..." : "Export All Data"}</span>
                </Button>
                
                <div className="text-sm text-gray-500">
                  File format: JSON • Size: ~1-50MB depending on data
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Import Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Upload className="h-5 w-5" />
                <span>Import Data</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600">
                Restore your data from a previously exported backup file. 
                This will replace all current data.
              </p>
              
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warning:</strong> Importing data will overwrite all existing 
                  information. Make sure to export your current data first if you want 
                  to keep it as a backup.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="backup-file">Select Backup File</Label>
                  <Input
                    id="backup-file"
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="mt-1"
                  />
                  {selectedFile && (
                    <p className="text-sm text-gray-600 mt-1">
                      Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>
                
                <Button 
                  onClick={handleImportData}
                  disabled={isImporting || !selectedFile}
                  variant="outline"
                  className="flex items-center space-x-2"
                >
                  <Upload className="h-4 w-4" />
                  <span>{isImporting ? "Importing..." : "Import Data"}</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Best Practices */}
          <Card>
            <CardHeader>
              <CardTitle>Best Practices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Regular Backups:</strong> Export your data weekly or monthly to ensure you don't lose important financial information.
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Secure Storage:</strong> Store backup files in a secure location such as cloud storage or encrypted drives.
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>File Naming:</strong> Use descriptive names with dates (e.g., "propertyfinance-backup-2024-03-15.json") for easy identification.
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Test Restores:</strong> Occasionally test importing your backups to ensure they work correctly.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
