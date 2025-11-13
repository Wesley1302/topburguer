import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

interface Lead {
  id: string;
  name: string;
  whatsapp: string;
  created_at: string;
}

export default function Admin() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error("Erro ao carregar leads:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("pt-BR");
  };

  const formatWhatsApp = (whatsapp: string) => {
    // Format: +55 (21) 99297-7203
    const clean = whatsapp.replace(/\D/g, "");
    if (clean.length === 13) {
      return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
    }
    return whatsapp;
  };

  const downloadCSV = () => {
    // Create CSV header
    const csvRows = [];
    csvRows.push("Nome,WhatsApp,Data e Hora");

    // Add data rows
    leads.forEach(lead => {
      const name = lead.name.replace(/,/g, " "); // Remove commas from name
      const phone = formatWhatsApp(lead.whatsapp);
      const date = formatDate(lead.created_at);
      
      csvRows.push(`${name},${phone},${date}`);
    });

    // Join all rows with line breaks
    const csvContent = csvRows.join("\n");

    // Create blob with UTF-8 BOM for Excel compatibility
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `leads_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 p-4">
      <div className="max-w-7xl mx-auto">
        <Card className="bg-white/95 backdrop-blur shadow-2xl">
          <CardHeader className="border-b">
            <div className="flex justify-between items-center">
              <CardTitle className="text-3xl font-bold text-gray-800">
                🎯 Painel Administrativo
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={downloadCSV}
                  disabled={leads.length === 0}
                  className="bg-green-50 hover:bg-green-100 text-green-700 border-green-300"
                >
                  📥 Baixar CSV
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    localStorage.removeItem("registered");
                    navigate("/");
                  }}
                >
                  ← Voltar
                </Button>
              </div>
            </div>
            <p className="text-gray-600 mt-2">
              Total de leads cadastrados: <strong>{leads.length}</strong>
            </p>
          </CardHeader>
          <CardContent className="p-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
                <p className="mt-4 text-gray-600">Carregando leads...</p>
              </div>
            ) : leads.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600 text-lg">Nenhum lead cadastrado ainda.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-bold">Nome</TableHead>
                      <TableHead className="font-bold">WhatsApp</TableHead>
                      <TableHead className="font-bold">Data de Cadastro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead) => (
                      <TableRow key={lead.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium text-black">{lead.name}</TableCell>
                        <TableCell>
                          <a
                            href={`https://wa.me/${lead.whatsapp}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-600 hover:text-green-700 hover:underline"
                          >
                            {formatWhatsApp(lead.whatsapp)}
                          </a>
                        </TableCell>
                        <TableCell className="text-gray-600">
                          {formatDate(lead.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
