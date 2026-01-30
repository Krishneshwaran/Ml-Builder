import { useState } from "react";
import { Plus, X, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface LabelEditorProps {
  labels: string[];
  onLabelsChange: (labels: string[]) => void;
}

export function LabelEditor({ labels, onLabelsChange }: LabelEditorProps) {
  const [newLabel, setNewLabel] = useState("");

  const addLabel = () => {
    if (newLabel.trim() && !labels.includes(newLabel.trim())) {
      onLabelsChange([...labels, newLabel.trim()]);
      setNewLabel("");
    }
  };

  const removeLabel = (label: string) => {
    onLabelsChange(labels.filter((l) => l !== label));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addLabel();
    }
  };

  return (
    <Card data-testid="label-editor">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="text-base">Dataset Labels</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Add a label (e.g., 'verified', 'rejected')"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={handleKeyDown}
            data-testid="input-new-label"
          />
          <Button onClick={addLabel} disabled={!newLabel.trim()} data-testid="button-add-label">
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {labels.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {labels.map((label) => (
              <Badge
                key={label}
                variant="secondary"
                className="gap-1.5 pr-1.5"
                data-testid={`label-${label}`}
              >
                {label}
                <button
                  onClick={() => removeLabel(label)}
                  className="ml-1 rounded-full hover:bg-foreground/10 p-0.5"
                  data-testid={`button-remove-label-${label}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No labels defined yet. Add labels to categorize your data.
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Labels help the model learn to classify your data. Add all possible categories.
        </p>
      </CardContent>
    </Card>
  );
}
