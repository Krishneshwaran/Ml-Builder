import { Shield, Eye, Recycle, ShoppingCart, FileText, Users, LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SystemTemplate } from "@shared/schema";

const iconMap: Record<string, LucideIcon> = {
  Shield,
  Eye,
  Recycle,
  ShoppingCart,
  FileText,
  Users,
};

interface TemplateCardProps {
  template: SystemTemplate;
  selected?: boolean;
  onClick?: () => void;
}

export function TemplateCard({ template, selected, onClick }: TemplateCardProps) {
  const Icon = iconMap[template.icon] || Shield;

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200 hover-elevate",
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
      onClick={onClick}
      data-testid={`template-card-${template.id}`}
    >
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className={cn(
            "flex items-center justify-center w-11 h-11 rounded-lg shrink-0",
            selected ? "bg-primary" : "bg-primary/10"
          )}>
            <Icon className={cn(
              "w-5 h-5",
              selected ? "text-primary-foreground" : "text-primary"
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold text-foreground truncate">{template.name}</h3>
              <Badge variant="secondary" className="text-xs shrink-0">
                {template.category}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {template.description}
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {template.dataTypes.map((type) => (
                <Badge key={type} variant="outline" className="text-xs capitalize">
                  {type}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
